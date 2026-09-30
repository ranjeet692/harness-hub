import { describe, expect, it } from "vitest";
import { DOMAINS } from "../src/domains";
import { allSwitches, runInstant } from "../src/engine/run";
import { CONCEPTS } from "../src/engine/concepts";
import { evalSuite, passes } from "../src/evals/suite";

/* The release gate, enforced in CI: every harness runs its full eval suite on every push.
   A harness change that breaks a scenario, a pair of edge cases or a safety bar fails here
   and blocks the deploy. */

describe.each(DOMAINS.map(d => [d.id, d] as const))("%s eval suite", (_, d) => {
  it("passes the release gate", async () => {
    const s = await evalSuite(d);
    for (const g of s.gate) expect(g.pass, `${g.label}: ${g.value} (target ${g.target})`).toBe(true);
  });

  it("the naive harness fails every scenario, so the graders can tell the difference", async () => {
    const s = await evalSuite(d);
    for (const row of s.scenarios) expect(passes(row.naive, d.goals.length), row.label).toBe(false);
  });

  it("removing a core guard is caught by an outcome grader, not just the concept board", async () => {
    const s = await evalSuite(d);
    const caught = s.ablations.filter(a => a.breaks).map(a => a.concept);
    for (const c of ["gate", "idem", "inject", "budget"] as const) expect(caught, c).toContain(c);
    expect(caught.length).toBeGreaterThanOrEqual(10);
  });
});

describe("ablation mechanics", () => {
  it("switching nothing off is the hardened harness", async () => {
    for (const d of DOMAINS) {
      const a = (await runInstant(d, "hardened", allSwitches(d))).result!;
      const b = (await runInstant(d, "hardened", allSwitches(d), [])).result!;
      expect(b).toEqual(a);
    }
  });

  it("every single-concept ablation runs to completion and marks that concept missed if it came up", async () => {
    for (const d of DOMAINS) for (const c of CONCEPTS) {
      const run = await runInstant(d, "hardened", allSwitches(d), [c.id]);
      expect(run.done, `${d.id} without ${c.id}`).toBe(true);
      if (!["ctx", "mem", "loop", "parallel", "eval"].includes(c.id)) expect(run.S.hit[c.id], `${d.id} without ${c.id}`).not.toBe("ok");
    }
  });
});
