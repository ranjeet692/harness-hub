import { describe, expect, it } from "vitest";
import { CONCEPTS } from "../src/engine/concepts";
import { DOMAINS } from "../src/domains";
import { BLUEPRINTS } from "../src/blueprint/domains";
import { EXAMPLE_REQUIREMENT, exampleDesign } from "../src/blueprint/example";
import { clientSummary, designDoc, evalCsv, skeleton } from "../src/blueprint/exports";
import { CONCEPT_IDS, CONCEPT_STEP, QUESTION, STEPS, analyze, coverage, emptyDesign, suggestTrace, surfaced, verdict } from "../src/blueprint/model";

const labelsFor = (text: string) => analyze(text).map(f => `${f.rule.label}:${f.text.toLowerCase()}`);

describe("requirement highlighter", () => {
  it("finds the harness work in the worked example", () => {
    const found = surfaced(analyze(EXAMPLE_REQUIREMENT));
    for (const c of ["budget", "gate", "idem", "inject", "mem", "parallel", "stophook", "tiers"] as const) expect(found, c).toContain(c);
  });

  it("reads “never pay twice” as idempotency, not a forbidden tool", () => {
    expect(labelsFor("It must never pay a vendor twice.")).toContain("Idempotency:must never pay a vendor twice");
  });

  it("treats a plain “never” as a tool to leave out", () => {
    expect(analyze("The bot must never delete customer accounts.").map(f => f.rule.concept)).toContain("tiers");
  });

  it("catches limits, approvals and untrusted inputs in other wording", () => {
    const l = labelsFor("Refunds up to $200 can go through; anything else needs sign-off. Requests come in by email.");
    expect(l.some(x => x.startsWith("Budget:up to $200"))).toBe(true);
    expect(l.some(x => x.startsWith("Gate:sign-off"))).toBe(true);
    expect(l.some(x => x.startsWith("Injection:"))).toBe(true);
  });

  it("never returns overlapping highlights", () => {
    const f = analyze(EXAMPLE_REQUIREMENT);
    for (let i = 1; i < f.length; i++) expect(f[i].start).toBeGreaterThanOrEqual(f[i - 1].end);
    for (const x of f) expect(EXAMPLE_REQUIREMENT.slice(x.start, x.end)).toBe(x.text);
  });

  it("finds nothing in an empty requirement and still gives a verdict", () => {
    expect(analyze("")).toEqual([]);
    expect(verdict("").title).toMatch(/Paste/);
  });

  it("calls a judgment-free requirement a workflow", () => {
    expect(verdict("Every morning, copy yesterday's sales into the sheet and post a summary to Slack.").shape).toBe("workflow");
    expect(verdict(EXAMPLE_REQUIREMENT).shape).toBe("workflow+agent");
  });

  it("suggests one trace row per rule, each with an edge case and a threshold", () => {
    const rows = suggestTrace(analyze(EXAMPLE_REQUIREMENT));
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const r of rows) { expect(r.edge).not.toBe(""); expect(r.hold).not.toBe(""); }
  });
});

describe("the design method", () => {
  it("decides each of the 20 concepts in exactly one step, with a question", () => {
    expect(Object.keys(CONCEPT_STEP).sort()).toEqual(CONCEPTS.map(c => c.id).sort());
    const stepIds = STEPS.map(s => s.id);
    for (const id of CONCEPT_IDS) { expect(stepIds).toContain(CONCEPT_STEP[id]); expect(QUESTION[id].length).toBeGreaterThan(20); }
  });

  it("counts coverage: an empty design is all open, the example is ready", () => {
    const e = coverage(emptyDesign());
    expect(e.open).toBe(20);
    expect(e.ready).toBe(false);
    const x = coverage(exampleDesign());
    expect(x.ready).toBe(true);
    expect(x.decided + x.na).toBe(20);
  });

  it("separates open concepts the text surfaced from ones it didn't", () => {
    const c = coverage(emptyDesign(), ["budget", "gate"]);
    expect(c.surfacedOpen).toBe(2);
    expect(c.open).toBe(18);
  });
});

describe("exports", () => {
  const d = exampleDesign();

  it("design doc has HLD, LLD and traceability, with no open items", () => {
    const md = designDoc(d);
    for (const h of ["# High-level design", "# Low-level design", "## Traceability", "## Tools", "sap.schedule_payment"]) expect(md).toContain(h);
    expect(md).not.toContain("OPEN");
  });

  it("marks open concepts in the design doc", () => {
    expect(designDoc(emptyDesign())).toContain("OPEN");
  });

  it("client summary is plain language, with who-decides-what and a sign-off", () => {
    const md = clientSummary(d);
    expect(md).toContain("A person approves before it can:");
    expect(md).toContain("It can never:");
    expect(md).toContain("Sign-off");
    expect(md).not.toMatch(/idempotency|stop hook/i);
  });

  it("eval CSV has a header and one row per trace, quotes escaped", () => {
    const csv = evalCsv({ ...d, trace: [...d.trace, { said: 'He said "hi"', concept: "gate", edge: "x", hold: "y" }] });
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("id,requirement,concept,edge_case,must_hold,result");
    expect(lines).toHaveLength(d.trace.length + 2);
    expect(csv).toContain('"He said ""hi"""');
  });

  it("skeleton is a harness-hub domain with the design's switches, goals and tiers", () => {
    const ts = skeleton(d);
    expect(ts).toContain("export const apInvoiceAgent: Domain");
    expect(ts).toContain('id: "ap-invoice-agent"');
    expect(ts).toContain("never:   [\"vendor.update_bank\"]");
    expect((ts.match(/\{ id: "g\d+"/g) ?? []).length).toBe(d.done.length);
    for (const c of CONCEPT_IDS) expect(ts).toContain(`    ${c}: `);
  });
});

describe("blueprints of the six harnesses", () => {
  it("every harness has one", () => {
    for (const d of DOMAINS) expect(BLUEPRINTS[d.id], d.id).toBeDefined();
  });

  it("every trace row points at a real switch and a real concept", () => {
    const concepts = new Set(CONCEPT_IDS);
    for (const d of DOMAINS) {
      const sw = new Set(d.switches.map(s => s.id));
      for (const t of BLUEPRINTS[d.id].trace) {
        expect(sw.has(t.sw), `${d.id}: ${t.sw}`).toBe(true);
        expect(concepts.has(t.concept), `${d.id}: ${t.concept}`).toBe(true);
      }
    }
  });

  it("covers most of each harness's edge cases", () => {
    for (const d of DOMAINS) {
      const traced = new Set(BLUEPRINTS[d.id].trace.map(t => t.sw));
      expect(traced.size, d.id).toBeGreaterThanOrEqual(d.switches.length - 1);
    }
  });
});
