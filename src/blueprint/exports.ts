import { CONCEPTS, type ConceptId } from "../engine/concepts";
import { CONCEPT_LABEL, RISKS, type Design } from "./model";

/* What you take away from the builder: a design doc for engineers, a client summary in plain
   language, an eval checklist and a harness-hub domain skeleton. Plain strings, so they can be
   downloaded, copied or tested. */

const AUTONOMY = { suggest: "Suggests only", approve: "Asks first", alone: "Acts alone", never: "Never" } as const;
const TIER = { safe: "Safe", confirm: "Asks first", never: "Never exposed" } as const;
const SHAPE = { workflow: "A workflow (fixed steps, no model loop)", "workflow+agent": "A workflow with an agent step", agent: "One agent loop", multi: "An orchestrator with subagents" } as const;

const cell = (s: string) => (s || "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
const title = (d: Design) => d.name.trim() || "Untitled harness";

function table(head: string[], rows: string[][]) {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map(r => `| ${r.map(cell).join(" | ")} |`)].join("\n");
}

export function designDoc(d: Design): string {
  const risks = RISKS.filter(r => d.risks[r.id]);
  const byGroup = (g: string) => CONCEPTS.filter(c => c.group === g).map(c => {
    const x = d.concepts[c.id];
    return `- **${c.label}** · ${x.status === "decided" ? "decided" : x.status === "na" ? "not needed" : "OPEN"}: ${x.note || "—"}`;
  }).join("\n");
  return `# ${title(d)} · harness design
${d.client ? `\nClient: ${d.client}\n` : ""}
Made with harness-hub Blueprint. HLD answers what the agent is for and what it may touch; LLD answers how the harness enforces it.

## Requirement

> ${d.requirement.trim().replace(/\n/g, "\n> ") || "—"}

# High-level design

## The job

${d.job || "—"}

**Done means** (checked in code, not taken from the model):

${d.done.filter(Boolean).map(x => `- ${x}`).join("\n") || "- —"}

## Shape

${SHAPE[d.shape]}. At most ${d.maxRounds} rounds per task.

## World

${table(["System", "Access", "Source of truth", "Money", "Untrusted text", "Notes"], d.world.map(s => [s.name, s.access, s.truth ? "yes" : "", s.money ? "yes" : "", s.untrusted ? "yes" : "", s.note]))}

## Autonomy, per action

${table(["Action", "Autonomy", "Why"], d.actions.map(a => [a.label, AUTONOMY[a.autonomy], a.why]))}

## Risks

${risks.length ? risks.map(r => `- ${r.label} (${r.hint.replace(/\.$/, "")})`).join("\n") : "- None marked"}

# Low-level design

## Tools

${table(["Tool", "Does", "Tier", "Idempotency key", "Timeout · retry", "Undo"], d.tools.map(t => [t.name, t.does, TIER[t.tier], t.key, t.retry, t.undo]))}

## Decisions, by concept

### Context
${byGroup("Context")}

### Tools
${byGroup("Tools")}

### Loop control
${byGroup("Loop control")}

### Safety
${byGroup("Safety")}

### Evaluation
${byGroup("Evaluation")}

# Verification

## Traceability

${table(["The client said", "Concept", "Edge case we run", "Must hold"], d.trace.map(t => [t.said, CONCEPT_LABEL[t.concept], t.edge, t.hold]))}
${d.questions.filter(Boolean).length ? `\n## Open questions for the client\n\n${d.questions.filter(Boolean).map(q => `- ${q}`).join("\n")}\n` : ""}`;
}

export function clientSummary(d: Design): string {
  const alone = d.actions.filter(a => a.autonomy === "alone").map(a => a.label.toLowerCase());
  const ask = d.actions.filter(a => a.autonomy === "approve" || a.autonomy === "suggest").map(a => a.label.toLowerCase());
  const never = d.actions.filter(a => a.autonomy === "never").map(a => a.label.toLowerCase());
  const risks = RISKS.filter(r => d.risks[r.id]);
  return `# ${title(d)}: proposal summary
${d.client ? `\nPrepared for ${d.client}\n` : ""}
## What it does

${d.job || "—"}

## How we'll know it worked

${d.done.filter(Boolean).map(x => `- ${x}`).join("\n") || "- —"}

## What it works with

${d.world.map(s => `- **${s.name}**: ${s.access === "read" ? "reads only" : s.access === "write" ? "writes" : "reads and writes"}${s.truth ? ", and treats it as the source of truth" : ""}${s.note ? `. ${s.note}` : ""}`).join("\n") || "- —"}

## Who decides what

- **The assistant acts on its own to:** ${alone.join("; ") || "nothing"}.
- **A person approves before it can:** ${ask.join("; ") || "nothing"}.
- **It can never:** ${never.join("; ") || "nothing listed"}. These aren't rules it's asked to follow; it simply isn't given the ability.

## Risks we designed for

${risks.map(r => `- ${r.label}.`).join("\n") || "- —"}

## How we'll test it before go-live

Each part of your request is turned into a test case that must pass:

${d.trace.map(t => `- ${t.said}: ${t.edge.replace(/\.$/, "")}. Must hold: ${t.hold}.`).join("\n") || "- —"}

## Questions for you

${d.questions.filter(Boolean).map(q => `- ${q}`).join("\n") || "- None at this stage."}

## Sign-off

Approved by: ____________________  Date: __________
`;
}

export function evalCsv(d: Design): string {
  const q = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
  return ["id,requirement,concept,edge_case,must_hold,result", ...d.trace.map((t, i) => [`E${i + 1}`, q(t.said), q(CONCEPT_LABEL[t.concept]), q(t.edge), q(t.hold), ""].join(","))].join("\n") + "\n";
}

const slug = (s: string, fb: string) => (s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || fb);
const ident = (s: string) => slug(s, "myharness").replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^[0-9]/, "h$&");
const js = (s: string) => JSON.stringify(s ?? "");

/** A harness-hub domain file to start from: copy, write the beats, register, run the tests. */
export function skeleton(d: Design): string {
  const id = ident(title(d));
  const switches = d.trace.map((t, i) => `    { id: ${js(slug(t.edge, "edge" + (i + 1)).slice(0, 24))}, label: ${js(t.edge)} },`).join("\n");
  const goals = d.done.filter(Boolean).map((g, i) => `    { id: "g${i + 1}", label: ${js(g.length > 40 ? g.slice(0, 38) + "…" : g)} },`).join("\n");
  const devices = d.world.map((s, i) => `    { id: ${js(slug(s.name, "sys" + (i + 1)).slice(0, 20))}, label: ${js(s.name)} },`).join("\n");
  const concepts = (CONCEPTS.map(c => c.id) as ConceptId[]).map(c => `    ${c}: ${js(d.concepts[c].note || "TODO: how this concept shows up here.")},`).join("\n");
  const tiers = (t: "safe" | "confirm" | "never") => d.tools.filter(x => x.tier === t).map(x => js(x.name)).join(", ");
  return `/**
 * ${title(d)}: a harness-hub domain skeleton, generated by Blueprint.
 *
 * 1. Save as src/domains/${slug(title(d), "my-harness")}/index.ts.
 * 2. Write one beat per step of the scenario, with a hardened branch (S.H) and a naive one.
 *    Call hit(id) when the hardened harness handles a concept, hit(id, "miss") when naive fails it.
 * 3. Register it in src/domains/index.ts and run npm test.
 *
 * Tool tiers from the design:
 *   safe:    [${tiers("safe")}]
 *   confirm: [${tiers("confirm")}]
 *   never:   [${tiers("never")}]
 */
import type { Domain, ReportLine } from "../../engine/types";
import type { Run } from "../../engine/run";

export const ${id}: Domain = {
  id: ${js(slug(title(d), "my-harness"))},
  number: "07",
  title: ${js(`The ${title(d)} Harness`)},
  shortTitle: ${js(title(d))},
  tagline: ${js(d.job || "One line for the home page card.")},
  eyebrow: "harness-hub · prototype 07",
  dek: ${js(d.job)},
  requestLabel: "The request",
  request: ${js(d.requirement)},
  userLabel: "You",
  runLabel: "Run",
  window: 16000,
  modeHelp: {
    hardened: "The design as specified: tiers, guards, approvals and a stop hook.",
    naive: "The same model with a thin loop: every tool exposed, nothing checked.",
  },
  concepts: {
${concepts}
  },
  switches: [
${switches || '    { id: "example", label: "An example edge case" },'}
  ],
  goals: [
${goals || '    { id: "goal", label: "The one goal" },'}
  ],
  devices: [
${devices || '    { id: "thing", label: "A thing in the world" },'}
  ],
  initState() {},
  initWorld() {},
  gauge2: S => ({ label: "Rounds", text: \`\${S.rounds} / ${d.maxRounds}\`, pct: (S.rounds / ${d.maxRounds}) * 100, marker: 100 }),
  stats: [["Rounds", S => S.rounds], ["Retries", S => S.retries]],
  compactText: "Older rounds were summarized. Rules and pinned facts stay word for word.",
  overflowText: "The naive harness silently dropped the oldest messages.",
  overflowIncident: "Context overflow dropped the rules",
  reportTitle: "Final answer → you",
  reportIntroH: "Here's what happened:",
  reportIntroN: "All done!",
  beats(run: Run) {
    const { mround, setV, hit, wait } = run;
    async function bStart() {
      const c = mround("first_tool", {});
      await wait(400);
      setV(c, "success", "TODO: write the scenario.");
      hit("loop");
    }
    return [bStart];
  },
  finalizeGoals() {},
  reportLines(S) { const L: ReportLine[] = []; S.caveats.forEach((t: string) => L.push(["caveat", t])); return L; },
  extraMetrics: () => [],
  extraResult: () => ({}),
  compareRows: [],
};
`;
}
