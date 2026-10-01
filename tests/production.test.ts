import { describe, expect, it } from "vitest";
import { DOMAINS } from "../src/domains";
import { allSwitches, runInstant } from "../src/engine/run";
import { PROD } from "../src/production/domains";
import { checklist, traceOf } from "../src/production/model";

/* Every runbook names the edge case and the missing guard that cause its incident. This checks
   the incident really reproduces: with the guard in place the hardened harness is clean, and
   without it the same scenario gets worse. That's the regression test the fix ships with. */

describe.each(DOMAINS.map(d => [d.id, d] as const))("%s production plan", (_, d) => {
  const plan = PROD[d.id];

  it("exists, with SLOs, a kill switch and three runbooks", () => {
    expect(plan).toBeDefined();
    expect(plan.slos.length).toBeGreaterThanOrEqual(3);
    expect(plan.killSwitch.length).toBeGreaterThan(40);
    expect(plan.runbooks).toHaveLength(3);
  });

  it.each(plan.runbooks.map(r => [r.incident, r] as const))("reproduces: %s", async (_, r) => {
    expect(d.switches.map(s => s.id), r.repro.sw).toContain(r.repro.sw);
    const sw = { ...allSwitches(d, false), [r.repro.sw]: true };
    const guarded = (await runInstant(d, "hardened", sw)).result!;
    const without = (await runInstant(d, "hardened", sw, [r.repro.off])).result!;
    expect(guarded.safety + guarded.unapproved).toBe(0);
    const worse = without.goals < guarded.goals || without.safety > 0 || without.unapproved > 0;
    expect(worse, `${d.id}: ${r.incident}`).toBe(true);
  });

  it("builds a trace with a span per model round and a tool span per call", async () => {
    const run = await runInstant(d, "hardened", allSwitches(d));
    const t = traceOf(d, run.cards, "hardened");
    const rounds = run.cards.filter(c => c.actor === "model").length;
    expect(t.spans.filter(s => s.kind === "llm")).toHaveLength(rounds);
    const parallelCalls = run.cards.flatMap(c => c.blocks).reduce((n, b) => n + (b.kind === "parallel" ? b.rows.length : 0), 0);
    expect(t.spans.filter(s => s.kind === "tool").length).toBe(run.cards.filter(c => c.actor === "model" && c.code).length + parallelCalls);
    for (const s of t.spans) if (s.parentSpanId) expect(t.spans.some(p => p.spanId === s.parentSpanId), s.name).toBe(true);
    expect(t.spans.some(s => s.kind === "human")).toBe(true);
  });

  it("marks the checklist honestly: some demo, some specified, some still to build", () => {
    const c = checklist(d);
    for (const s of ["demo", "spec", "gap"] as const) expect(c.some(i => i.status === s), s).toBe(true);
  });
});
