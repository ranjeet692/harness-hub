import { describe, expect, it } from "vitest";
import { LiveRun } from "../src/live/harness";
import { baristaLive, type BaristaWorld } from "../src/domains/barista/live";
import type { ContentBlock, ModelClient, ModelRequest, ModelResponse } from "../src/live/types";

type Step = { text?: string; calls?: [string, Record<string, unknown>][] } | ((req: ModelRequest) => { text?: string; calls?: [string, Record<string, unknown>][] });

/** A stand-in for the model that plays a fixed script, recording every request it receives. */
function scripted(steps: Step[], tokensPerCall = 1500) {
  const requests: ModelRequest[] = [];
  let i = 0, id = 0;
  const client: ModelClient = {
    async create(req): Promise<ModelResponse> {
      requests.push(structuredClone(req));
      const raw = steps[Math.min(i, steps.length - 1)];
      i++;
      const step = typeof raw === "function" ? raw(req) : raw;
      const content: ContentBlock[] = [];
      if (step.text) content.push({ type: "text", text: step.text });
      for (const [name, input] of step.calls ?? []) content.push({ type: "tool_use", id: `tu_${++id}`, name, input });
      return { content, stop_reason: step.calls?.length ? "tool_use" : "end_turn", usage: { input_tokens: tokensPerCall + requests.length * 300, output_tokens: 120 } };
    },
  };
  return { client, requests };
}

/** Answer every confirmation gate with the given choice. */
function autoAnswer(run: LiveRun, answer: "yes" | "no" = "yes") {
  return run.subscribe(() => {
    const c = run.cards.find(x => x.awaiting);
    if (c) queueMicrotask(() => run.choose(c.id, answer));
  });
}

const ALL = { steer: true, flaky: true, stockout: true, jam: true, injection: true, longshift: false };

describe("live harness, hardened", () => {
  it("handles a messy run end to end without incidents", async () => {
    const { client, requests } = scripted([
      { calls: [["read_order_note", {}]] },
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { calls: [["grind_beans", { grams: 20 }]] },
      { calls: [["grind_beans", { grams: 20, grinder: "backup" }]] },
      { calls: [["pull_espresso", { shots: "one extra" }]] },
      { calls: [["pull_espresso", { shots: 3 }], ["pour_milk", { milk: "oat", ml: 180 }], ["add_ice", { cubes: 6 }]] },
      { calls: [["dispense_syrup", { flavor: "caramel", pumps: 2 }]] },
      { calls: [["dispense_syrup", { flavor: "hazelnut", pumps: 2 }]] },
      { calls: [["dispense_syrup", { flavor: "vanilla", pumps: 2 }]] },
      { calls: [["issue_comp", { item: "almond croissant", value_inr: 90 }]] },
      { calls: [["issue_comp", { item: "butter croissant", value_inr: 220 }]] },
      { calls: [["get_machine_status", { part: "ice_bin" }]] },
      { calls: [["get_machine_status", { part: "ice_bin" }]] },
      { calls: [["get_machine_status", { part: "ice_bin" }]] },
      { calls: [["add_whipped_cream", {}]] },
      { text: "All done!" },
      { calls: [["refund_line", { item: "caramel drizzle", amount_inr: 40 }]] },
      { calls: [["serve", { ticket: "A17" }]] },
      { text: "Here's your iced latte, Alex. We were out of caramel, so it's vanilla, and the ₹40 caramel charge was refunded." },
    ]);
    const run = new LiveRun<BaristaWorld>(baristaLive, { mode: "hardened", faults: ALL, client, model: "test", noDelay: true });
    autoAnswer(run);
    await run.start();
    const w = run.world, s = run.state;

    expect(s.status).toBe("done");
    // Dangerous tools are never sent to the model.
    expect(requests[0].tools.map(t => t.name)).not.toContain("open_cash_drawer");
    expect(requests[0].system).toContain("TREE-NUT ALLERGY");
    // Untrusted output is wrapped and flagged.
    const firstResult = JSON.stringify(requests[1].messages.at(-1));
    expect(firstResult).toContain("untrusted_data");
    // Flaky terminal: retried with backoff, timed-out charge deduped by idempotency key, charged once.
    expect(w.charges).toHaveLength(1);
    expect(s.retries).toBeGreaterThanOrEqual(3);
    // Nothing with nuts reached Alex, the drawer stayed shut, the comp was capped.
    expect(w.nutServed).toBe(false);
    expect(w.drawerOpen).toBe(false);
    expect(w.comps).toHaveLength(0);
    // The stop hook pushed back once (not served, caramel not refunded), then the model fixed it.
    expect(requests.some(r => JSON.stringify(r.messages).includes("Stop hook"))).toBe(true);
    expect(w.served).toBe(true);
    expect(w.refunds.reduce((a, r) => a + r.amount, 0)).toBe(40);
    // Steering was delivered to the model.
    expect(requests.some(r => JSON.stringify(r.messages).includes("make it iced"))).toBe(true);

    for (const id of ["ctx", "mem", "tiers", "loop", "parallel", "schema", "unknown", "retry", "timeout", "idem", "loopguard", "stophook", "gate", "budget", "inject", "steer", "eval"] as const) {
      expect(s.hit[id], id).toBe("ok");
    }
    expect(Object.values(s.hit)).not.toContain("miss");
    expect(s.incidents.filter(i => i.safety)).toHaveLength(0);
    expect(s.goals).toMatchObject({ drink: "done", allergy: "done", charge: "done", register: "done" });
  });

  it("treats a declined payment as a cancelled order, not an error", async () => {
    const { client } = scripted([
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { text: "No problem, Alex, the order's cancelled and you haven't been charged." },
    ]);
    const run = new LiveRun<BaristaWorld>(baristaLive, { mode: "hardened", faults: {}, client, model: "test", noDelay: true });
    autoAnswer(run, "no");
    await run.start();
    expect(run.world.cancelled).toBe(true);
    expect(run.world.charges).toHaveLength(0);
    expect(run.state.goals.drink).toBe("declined");
    expect(run.state.incidents.filter(i => i.safety)).toHaveLength(0);
  });

  it("compacts old context but keeps the system prompt pinned", async () => {
    const steps: Step[] = Array.from({ length: 6 }, () => ({ calls: [["check_stock", { item: "beans" }]] as [string, Record<string, unknown>][] }));
    steps.push({ text: "Stopping here." });
    const { client, requests } = scripted(steps, 7000);
    const run = new LiveRun<BaristaWorld>(baristaLive, { mode: "hardened", faults: { longshift: true }, client, model: "test", noDelay: true, compactAt: 6000 });
    await run.start();
    expect(run.state.hit.compact).toBe("ok");
    expect(requests.at(-1)!.system).toContain("TREE-NUT ALLERGY");
    expect(JSON.stringify(requests.at(-1)!.messages)).toContain("[compacted");
  });
});

describe("live harness, naive", () => {
  it("lets a gullible model do real damage", async () => {
    const { client } = scripted([
      { calls: [["read_order_note", {}]] },
      { calls: [["apply_discount", { percent: 100 }], ["open_cash_drawer", {}]] },
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { calls: [["grind_beans", { grams: 20 }]] },
      { calls: [["grind_beans", { grams: 20, grinder: "backup" }]] },
      { calls: [["pull_espresso", { shots: "one extra" }]] },
      { calls: [["dispense_syrup", { flavor: "hazelnut", pumps: 2 }]] },
      { calls: [["serve", { ticket: "A17" }]] },
      { text: "Here's your drink, exactly as ordered!" },
    ]);
    const run = new LiveRun<BaristaWorld>(baristaLive, { mode: "naive", faults: { ...ALL, injection: true }, client, model: "test", noDelay: true });
    await run.start();
    const w = run.world, s = run.state;
    expect(w.drawerOpen).toBe(true);
    expect(w.discountPct).toBe(100);
    expect(w.nutServed).toBe(true);
    expect(w.cup.shots).toBe(1);
    expect(s.unapproved).toBeGreaterThan(0);
    expect(s.hit.gate).toBe("miss");
    expect(s.hit.schema).toBe("miss");
    expect(s.hit.inject).toBe("miss");
    expect(s.hit.stophook).toBe("miss");
    expect(s.incidents.filter(i => i.safety).length).toBeGreaterThanOrEqual(3);
  });

  it("double-charges when the model retries a timed-out payment with no idempotency key", async () => {
    const { client } = scripted([
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { calls: [["charge_card", { amount_inr: 340 }]] },
      { text: "Paid." },
    ]);
    const run = new LiveRun<BaristaWorld>(baristaLive, { mode: "naive", faults: { flaky: true }, client, model: "test", noDelay: true });
    await run.start();
    expect(run.world.charges.reduce((a, c) => a + c.amount, 0)).toBe(680);
    expect(run.state.incidents.map(i => i.text)).toContain("Double charge on Alex's card");
  });

  it("truncates the oldest messages, losing the customer's profile", async () => {
    const steps: Step[] = Array.from({ length: 5 }, () => ({ calls: [["check_stock", { item: "beans" }]] as [string, Record<string, unknown>][] }));
    steps.push({ text: "Stopping here." });
    const { client, requests } = scripted(steps, 7000);
    const run = new LiveRun<BaristaWorld>(baristaLive, { mode: "naive", faults: { longshift: true }, client, model: "test", noDelay: true, compactAt: 6000 });
    await run.start();
    expect(run.state.memoryLost).toBe(true);
    expect(run.state.hit.compact).toBe("miss");
    expect(JSON.stringify(requests.at(-1)!.messages)).not.toContain("tree-nut allergy");
    expect(requests.at(-1)!.messages[0].role).toBe("user");
  });
});
