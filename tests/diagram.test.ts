import { describe, expect, it } from "vitest";
import { allSwitches, runInstant } from "../src/engine/run";
import { diagram } from "../src/domains/diagram";
import { coverageOf, parseMermaid, roundTrip, toMermaid, validateDoc, type Doc } from "../src/domains/diagram/model";

const base = (): Doc => ({
  kind: "flow", actors: [], msgs: [], focus: null,
  nodes: [
    { id: "s", label: "Customer requests refund", type: "start", col: 0, row: 0 },
    { id: "d", label: "Amount under ₹2,000?", type: "decision", col: 0, row: 1 },
    { id: "a", label: "Auto-approve", type: "step", col: -1, row: 2 },
    { id: "f", label: "Finance approves", type: "step", col: 1, row: 2 },
    { id: "e", label: "Refunded", type: "end", col: 0, row: 3 },
  ],
  edges: [
    { from: "s", to: "d" }, { from: "d", to: "a", label: "yes" }, { from: "d", to: "f", label: "no" },
    { from: "a", to: "e" }, { from: "f", to: "e" },
  ],
});

describe("diagram verification", () => {
  it("passes a well-formed flowchart", () => {
    expect(validateDoc(base())).toEqual([]);
    expect(roundTrip(base()).ok).toBe(true);
  });

  it("catches an arrow into a shape that doesn't exist, and the round trip catches it too", () => {
    const doc = base();
    doc.edges.push({ from: "f", to: "approval" });
    expect(validateDoc(doc).map(c => c.text).join()).toMatch(/doesn't exist/);
    const rt = roundTrip(doc);
    expect(rt.ok).toBe(false);
    expect(rt.problems.join()).toMatch(/extra shape/);
  });

  it("catches unlabelled branches, dead ends, unreachable and overlapping shapes", () => {
    const doc = base();
    doc.edges[1].label = undefined;
    doc.nodes.push({ id: "x", label: "Orphan", type: "step", col: 0, row: 3.2 });
    const text = validateDoc(doc).map(c => c.text).join(" | ");
    expect(text).toMatch(/unlabelled/);
    expect(text).toMatch(/dead end/);
    expect(text).toMatch(/unreachable/);
    expect(text).toMatch(/overlap/);
  });

  it("flags too many arrow crossings", () => {
    expect(validateDoc(base(), { crossings: 5 }).map(c => c.text).join()).toMatch(/cross 5 times/);
  });

  it("exports Mermaid that parses back to the same graph", () => {
    const back = parseMermaid(toMermaid(base()));
    expect(back.nodes.size).toBe(5);
    expect(back.edges).toHaveLength(5);
    expect(back.nodes.get("d")).toBe("Amount under ₹2,000?");
  });

  it("a sequence diagram can't carry the branches, so coverage drops", () => {
    const seq: Doc = { ...base(), kind: "sequence", actors: ["Customer", "Support", "Finance", "Gateway"], msgs: [
      { from: "Customer", to: "Support", label: "requests refund" }, { from: "Support", to: "Finance", label: "approve refund?" },
      { from: "Finance", to: "Gateway", label: "refund" }, { from: "Gateway", to: "Customer", label: "email confirmation" },
    ] };
    expect(coverageOf(seq).filter(Boolean).length).toBeLessThan(8);
  });
});

describe("diagram harness end to end", () => {
  it("hardened: covers the whole brief, passes every check, keeps your edits, publishes once", async () => {
    const run = await runInstant(diagram, "hardened", allSwitches(diagram));
    const S = run.S;
    expect(coverageOf(S.doc).every(Boolean)).toBe(true);
    expect(validateDoc(S.doc, { crossings: S.crossings })).toEqual([]);
    expect(roundTrip(S.doc).ok).toBe(true);
    expect(S.doc.nodes.filter((n: { pin?: string }) => n.pin)).toHaveLength(2);
    expect(S.published).toBe(1);
    expect(S.ops).toBeLessThanOrEqual(40);
  });

  it("naive: the picture looks done but fails verification", async () => {
    const run = await runInstant(diagram, "naive", allSwitches(diagram));
    const S = run.S;
    expect(coverageOf(S.doc).filter(Boolean).length).toBeLessThan(8);
    expect(validateDoc(S.doc, { crossings: S.crossings }).length).toBeGreaterThan(0);
    expect(roundTrip(S.doc).ok).toBe(false);
    expect(S.pinsKept).toBe(false);
    expect(S.published).toBe(2);
    expect(run.result!.falseClaims).toBeGreaterThan(0);
  });
});
