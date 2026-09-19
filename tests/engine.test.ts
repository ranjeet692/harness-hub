import { describe, expect, it } from "vitest";
import { Run, allSwitches, runInstant } from "../src/engine/run";
import { DOMAINS } from "../src/domains";
import { CONCEPTS } from "../src/engine/concepts";
import type { Domain } from "../src/engine/types";

/** Answer every decision with a fixed choice so non-instant paths can run headless. */
async function runWithChoices(domain: Domain, mode: "hardened" | "naive", sw: Record<string, boolean>, choices: string[]) {
  const run = new Run(domain, { mode, sw, instant: false, fast: true });
  let i = 0;
  const unsub = run.subscribe(() => {
    const waiting = run.cards.find(c => c.awaiting);
    if (waiting) {
      const block = waiting.blocks.find(b => b.kind === "choices");
      if (block && block.kind === "choices") {
        const want = choices[i];
        const pick = block.options.find(o => o.id === want) ?? block.options[0];
        i++;
        queueMicrotask(() => run.choose(waiting.id, pick.id));
      }
    }
  });
  await run.start();
  unsub();
  return run;
}

describe.each(DOMAINS.map(d => [d.id, d] as const))("%s", (_id, domain) => {
  it("defines a blurb for every concept", () => {
    for (const c of CONCEPTS) expect(domain.concepts[c.id], c.id).toBeTruthy();
  });

  it("hardened with every edge case on handles all 20 concepts with no incidents", async () => {
    const run = await runInstant(domain, "hardened", allSwitches(domain));
    const r = run.result!;
    expect(r.missed).toBe(0);
    expect(r.handled).toBe(CONCEPTS.length);
    expect(r.safety).toBe(0);
    expect(r.falseClaims).toBe(0);
    expect(r.goals).toBe(domain.goals.length);
  });

  it("naive with every edge case on misses the 16 harness concepts and makes false claims", async () => {
    const run = await runInstant(domain, "naive", allSwitches(domain));
    const r = run.result!;
    expect(r.missed).toBe(16);
    expect(r.safety).toBeGreaterThan(0);
    expect(r.falseClaims).toBeGreaterThan(0);
    expect(r.goals).toBeLessThan(domain.goals.length);
  });

  it("every single edge case runs to completion in both modes", async () => {
    for (const s of domain.switches) {
      for (const mode of ["hardened", "naive"] as const) {
        const run = await runInstant(domain, mode, { ...allSwitches(domain, false), [s.id]: true });
        expect(run.done, `${mode} ${s.id}`).toBe(true);
        if (mode === "hardened") expect(run.result!.safety, `${s.id}`).toBe(0);
      }
    }
  });

  it("declining every decision still finishes cleanly", async () => {
    const run = await runWithChoices(domain, "hardened", allSwitches(domain), ["cancel", "decline", "skip", "none", "none"]);
    expect(run.done).toBe(true);
    expect(run.result!.safety).toBe(0);
  });
});
