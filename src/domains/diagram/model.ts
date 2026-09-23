/* The diagram model and the checks that verify it. Pure functions, shared by the harness,
   the canvas and the tests. */

/** The eight things the brief actually asks for. Coverage is checked against this list. */
export const BRIEF_ITEMS = [
  "Customer requests a refund in the app",
  "Support reviews the order",
  "Decision: amount under ₹2,000?",
  "Under ₹2,000 is auto-approved",
  "Otherwise finance approves",
  "Payment gateway refunds",
  "Customer is emailed",
  "Gateway fails → retry once → escalate",
];

export interface DNode { id: string; label: string; type: "start" | "end" | "step" | "decision"; col: number; row: number; pin?: "moved" | "renamed"; flag?: "invented" | "overlap" }
export interface DEdge { from: string; to: string; label?: string; flag?: "dangling" | "unlabeled" }

export interface Doc { kind: "flow" | "sequence"; nodes: DNode[]; edges: DEdge[]; actors: string[]; msgs: { from: string; to: string; label: string }[]; focus: string | null }
export interface Check { level: "ok" | "info" | "warn" | "bad"; text: string }

/** Graph rules a published flowchart must pass. Pure, so the tests can run it too. */
export function validateDoc(doc: Doc, opts: { crossings?: number; maxCrossings?: number } = {}): Check[] {
  const out: Check[] = [];
  if (doc.kind === "sequence") {
    const bad = doc.msgs.filter(m => !doc.actors.includes(m.from) || !doc.actors.includes(m.to));
    bad.forEach(m => out.push({ level: "bad", text: `Message “${m.label}” has no lifeline to land on` }));
    return out;
  }
  const ids = new Set(doc.nodes.map(n => n.id));
  const byId = Object.fromEntries(doc.nodes.map(n => [n.id, n]));
  const name = (id: string) => byId[id]?.label ?? id;
  const starts = doc.nodes.filter(n => n.type === "start");
  if (starts.length !== 1) out.push({ level: "bad", text: `${starts.length} start shapes (needs exactly one)` });
  if (!doc.nodes.some(n => n.type === "end")) out.push({ level: "bad", text: "No end shape" });
  for (const e of doc.edges) if (!ids.has(e.from) || !ids.has(e.to)) out.push({ level: "bad", text: `Arrow from “${name(e.from)}” points at a shape that doesn't exist` });
  for (const n of doc.nodes) {
    const outs = doc.edges.filter(e => e.from === n.id && ids.has(e.to));
    if (n.type === "decision") {
      if (outs.length < 2) out.push({ level: "warn", text: `Decision “${n.label}” has only ${outs.length} branch${outs.length === 1 ? "" : "es"}` });
      else if (outs.some(e => !e.label)) out.push({ level: "warn", text: `Decision “${n.label}” has unlabelled branches` });
    } else if (n.type !== "end" && outs.length === 0) out.push({ level: "warn", text: `“${n.label}” is a dead end` });
  }
  const seen = new Set<string>();
  const queue = starts.map(s => s.id);
  while (queue.length) { const id = queue.shift()!; if (seen.has(id)) continue; seen.add(id); doc.edges.filter(e => e.from === id).forEach(e => queue.push(e.to)); }
  for (const n of doc.nodes) if (!seen.has(n.id)) out.push({ level: "warn", text: `“${n.label}” is unreachable` });
  for (let i = 0; i < doc.nodes.length; i++) for (let j = i + 1; j < doc.nodes.length; j++) {
    const a = doc.nodes[i], b = doc.nodes[j];
    if (a.col === b.col && Math.abs(a.row - b.row) < 0.6) out.push({ level: "bad", text: `“${a.label}” and “${b.label}” overlap` });
  }
  if ((opts.crossings ?? 0) > (opts.maxCrossings ?? 3)) out.push({ level: "warn", text: `Arrows cross ${opts.crossings} times (limit ${opts.maxCrossings ?? 3})` });
  return out;
}

/** Which of the eight brief items the canvas actually shows. */
export function coverageOf(doc: Doc): boolean[] {
  if (doc.kind === "sequence") {
    const m = doc.msgs.map(x => x.label).join(" | ");
    return [/refund/i.test(m), /review/i.test(m), false, false, /approve/i.test(m), /refund/i.test(m) && doc.actors.includes("Gateway"), /email/i.test(m), false];
  }
  const has = (re: RegExp, type?: DNode["type"]) => doc.nodes.some(n => re.test(n.label) && (!type || n.type === type));
  const edge = (a: RegExp, b: RegExp) => doc.edges.some(e => re(e.from, a) && re(e.to, b));
  const re = (id: string, r: RegExp) => r.test(doc.nodes.find(n => n.id === id)?.label ?? "");
  return [
    has(/request.*refund/i, "start"),
    has(/support/i),
    has(/2,000/, "decision"),
    has(/auto-approve/i) && edge(/2,000/, /auto-approve/i),
    has(/(finance|manager) approves/i) && edge(/2,000/, /approves/i),
    has(/gateway refunds/i),
    has(/email/i),
    has(/retry/i) && edge(/retry/i, /escalate/i),
  ];
}

/** The diagram as Mermaid text: what gets exported and published. */
export function toMermaid(doc: Doc): string {
  if (doc.kind === "sequence") {
    return ["sequenceDiagram", ...doc.actors.map(a => `  participant ${a}`), ...doc.msgs.map(m => `  ${m.from}->>${m.to}: ${m.label}`)].join("\n");
  }
  const shape = (n: DNode) => n.type === "decision" ? `{"${n.label}"}` : n.type === "step" ? `["${n.label}"]` : `(["${n.label}"])`;
  return [
    "flowchart TD",
    ...doc.nodes.map(n => `  ${n.id}${shape(n)}`),
    ...doc.edges.map(e => `  ${e.from} -->${e.label ? `|${e.label}|` : ""} ${e.to}`),
  ].join("\n");
}

/** Parse our own Mermaid back into shapes and arrows. Arrows to unknown ids create bare
    shapes, exactly as a Mermaid renderer would, which is how a dangling arrow gets caught. */
export function parseMermaid(text: string): { nodes: Map<string, string>; edges: string[] } {
  const nodes = new Map<string, string>();
  const edges: string[] = [];
  for (const raw of text.split("\n").slice(1)) {
    const line = raw.trim();
    const e = line.match(/^(\w+) -->(?:\|([^|]*)\|)? (\w+)$/);
    if (e) {
      edges.push(`${e[1]}>${e[3]}:${e[2] ?? ""}`);
      if (!nodes.has(e[1])) nodes.set(e[1], e[1]);
      if (!nodes.has(e[3])) nodes.set(e[3], e[3]);
      continue;
    }
    const n = line.match(/^(\w+)[[{(]+"([^"]*)"[\]})]+$/);
    if (n) nodes.set(n[1], n[2]);
  }
  return { nodes, edges };
}

/** Export, parse back, compare. Any difference means the picture and the data disagree. */
export function roundTrip(doc: Doc): { ok: boolean; problems: string[] } {
  if (doc.kind === "sequence") return { ok: true, problems: [] };
  const back = parseMermaid(toMermaid(doc));
  const problems: string[] = [];
  for (const n of doc.nodes) if (back.nodes.get(n.id) !== n.label) problems.push(`shape “${n.label}” changed on the way back`);
  for (const [id, label] of back.nodes) if (!doc.nodes.some(n => n.id === id)) problems.push(`an extra shape “${label}” appeared`);
  if (back.edges.length !== doc.edges.length) problems.push(`${doc.edges.length} arrows went out, ${back.edges.length} came back`);
  return { ok: problems.length === 0, problems };
}

