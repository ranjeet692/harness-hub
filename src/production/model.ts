/* Production readiness: what it takes to run one of these harnesses for real, and an honest
   account of how much of it this repository demonstrates. The trace and the budgets are built
   from real runs of the engine; the checklist says plainly what is demo, what is specified, and
   what a production deployment would still need to build. */

import type { ConceptId } from "../engine/concepts";
import type { Card, Domain } from "../engine/types";
import type { Suite } from "../evals/suite";

export type Status = "demo" | "spec" | "gap";
export interface CheckItem { area: string; label: string; status: Status; note: string; link?: string }

/** The readiness checklist. `live` marks harnesses that also run with a real model. */
export function checklist(d: Domain): CheckItem[] {
  const live = !!d.live;
  return [
    { area: "Observability", label: "Trace every round, tool call and guard decision", status: "demo", note: "Every run produces a structured trace; export one below." },
    { area: "Observability", label: "Token, round, retry and approval metrics per task", status: "demo", note: "Recorded on every run and shown on the scorecard." },
    { area: "Observability", label: "Deterministic replay of a run", status: live ? "spec" : "demo", note: live ? "Scripted runs replay exactly. Live runs would need model inputs and outputs recorded alongside the trace." : "Scripted runs are deterministic, so any run can be replayed exactly." },
    { area: "Observability", label: "Alerts on incidents and SLO burn", status: "gap", note: "Needs a metrics backend and paging. The signals to alert on are listed in the runbooks." },

    { area: "Evaluation", label: "Offline eval suite as a CI release gate", status: "demo", note: "114 runs per harness on every push; a failed check blocks the deploy.", link: `/d/${d.id}/evals` },
    { area: "Evaluation", label: "Ablation proof for each guard", status: "demo", note: "Each concept switched off in turn, with what breaks.", link: `/d/${d.id}/evals` },
    { area: "Evaluation", label: "Live-model evals: repeated runs, pass rate and variance", status: live ? "spec" : "gap", note: live ? "Live mode runs a real model through the same harness; a batch runner for N repeated runs isn't built yet." : "This harness runs scripted only. A live model would need its own repeated-run evals." },
    { area: "Evaluation", label: "Pinned model and prompt versions, upgraded only through the gate", status: "spec", note: "A new version ships only when the eval suite passes on it." },

    { area: "Safety", label: "Tool tiers enforced in code", status: "demo", note: "Safe, asks first and never exposed, per tool.", link: `/d/${d.id}/blueprint` },
    { area: "Safety", label: "Untrusted text wrapped as data", status: "demo", note: "Injection is one of the edge cases, and its ablation shows the damage without it." },
    { area: "Safety", label: "Per-user credentials with least-privilege scopes", status: "gap", note: "The demo's tools are simulated. Production needs OAuth-scoped credentials per user or service, never shared admin keys." },
    { area: "Safety", label: "Personal data redacted from logs and traces", status: "spec", note: "Traces should carry field names and IDs, not values like salaries or card numbers." },
    { area: "Safety", label: "Audit log of who approved what", status: "spec", note: "Approvals are in the trace; production needs them in an append-only store." },

    { area: "Reliability", label: "Retries with backoff, timeouts and idempotency keys", status: "demo", note: "Every flaky dependency in the scenarios is handled this way." },
    { area: "Reliability", label: "Durable execution: resume after a crash", status: "gap", note: "Runs live in memory. Production needs a queue or workflow engine that checkpoints each step." },
    { area: "Reliability", label: "Rate limits and concurrency caps", status: "spec", note: "Per dependency and per tenant, so one runaway task can't starve the rest." },
    { area: "Reliability", label: "Kill switch and feature flag", status: "spec", note: "Specified per harness below: what it turns off, and where work goes instead." },

    { area: "People", label: "Approval gates with a safe default", status: "demo", note: "Declining is a normal outcome; tested in the shared suite." },
    { area: "People", label: "Approval timeout and escalation", status: "spec", note: "No answer is never a yes: remind, then escalate, then hold." },
    { area: "People", label: "Handoff to a human queue with full context", status: "spec", note: "When the agent stops, a person gets the trace, the state and the reason." },

    { area: "Cost", label: "Budget guards in code", status: "demo", note: "Money, blast radius and battery caps, enforced before the call runs." },
    { area: "Cost", label: "Cost per task tracked and capped", status: "spec", note: "Tokens are tracked per task; the calculator below turns them into money. A hard per-task cap is the next step." },
  ];
}

/* ---------- a trace from a real run ---------- */

export interface Span {
  spanId: string; parentSpanId?: string; name: string; kind: "agent" | "llm" | "tool" | "guard" | "human";
  status: "ok" | "error" | "unset";
  attributes: Record<string, string | number | string[]>;
  events: { name: string; attributes: Record<string, string> }[];
}

const STATUS = (cls: string): Span["status"] => (cls === "danger" ? "error" : cls === "success" || cls === "info" ? "ok" : "unset");

/** Turn a run's cards into an OpenTelemetry-style span tree: one agent span, one span per model round,
    a tool span under it, and harness checks, subagents and approvals as child spans or events. */
export function traceOf(d: Domain, cards: Card[], mode: string): { traceId: string; spans: Span[] } {
  const traceId = `${d.id}-${mode}-demo`;
  const root: Span = { spanId: "0", name: `agent.run ${d.id}`, kind: "agent", status: "ok", attributes: { "harness.mode": mode, "agent.domain": d.id }, events: [] };
  const spans: Span[] = [root];
  let parent = root, n = 0;
  for (const c of cards) {
    const id = String(++n);
    const concepts: Record<string, string[]> = c.concepts.length ? { "harness.concepts": c.concepts as string[] } : {};
    if (c.actor === "model") {
      const round: Span = { spanId: id, parentSpanId: "0", name: c.title ?? "llm.round", kind: "llm", status: STATUS(c.verdict.cls), attributes: { ...concepts }, events: [] };
      spans.push(round); parent = round;
      if (c.code) {
        const tool = c.code.replace(/\(.*$/s, "");
        spans.push({ spanId: id + ".1", parentSpanId: id, name: `tool.call ${tool}`, kind: "tool", status: STATUS(c.verdict.cls), attributes: { "tool.name": tool, "tool.args": c.code.slice(tool.length), "tool.result": c.verdict.text }, events: [] });
      } else {
        round.attributes["llm.output"] = c.verdict.text || c.title || "";
      }
      // a parallel round: one tool span per call dispatched in it
      for (const b of c.blocks) if (b.kind === "parallel") b.rows.forEach((r, i) => {
        const tool = r.code.replace(/\(.*$/s, "");
        spans.push({ spanId: `${id}.p${i}`, parentSpanId: id, name: `tool.call ${tool}`, kind: "tool", status: r.tone === "danger" ? "error" : "ok", attributes: { "tool.name": tool, "tool.args": r.code.slice(tool.length), "tool.result": r.status, "tool.parallel": "true" }, events: [] });
      });
    } else if (c.actor === "harness" || c.actor === "subagent") {
      spans.push({ spanId: id, parentSpanId: parent.spanId, name: c.actor === "subagent" ? `subagent ${c.title}` : `harness.${(c.title ?? "check").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, kind: "guard", status: STATUS(c.verdict.cls), attributes: { ...concepts, "harness.message": c.verdict.text }, events: [] });
    } else if (c.actor === "user") {
      parent.events.push({ name: "user.message", attributes: { text: c.verdict.text } });
    } else if (c.actor === "eval") {
      root.events.push({ name: "eval.scorecard", attributes: { summary: c.verdict.text } });
    }
    if (c.blocks.some(b => b.kind === "choices") || /Chosen:|answered automatically/.test(c.blocks.map(b => ("text" in b ? b.text : "")).join(" "))) {
      const note = c.blocks.map(b => ("text" in b ? b.text : "")).find(t => /Chosen:|answered automatically/.test(t));
      spans.push({ spanId: id + ".h", parentSpanId: id, name: "human.approval", kind: "human", status: "ok", attributes: { decision: note ?? "pending" }, events: [] });
    }
  }
  return { traceId, spans };
}

/* ---------- budgets and SLOs, measured from the eval suite ---------- */

export interface Measured { passRate: number; maxRounds: number; tokensPerTask: number; naiveTokensPerTask: number; approvalsPerTask: number; incidentsNaive: number }

export function measure(s: Suite): Measured {
  const H = s.scenarios.map(x => x.hardened.result), N = s.scenarios.map(x => x.naive.result);
  const goals = s.scenarios.length;
  const pass = s.scenarios.filter(x => x.hardened.result.safety === 0 && x.hardened.result.unapproved === 0 && x.hardened.result.falseClaims === 0).length;
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  return {
    passRate: pass / goals,
    maxRounds: Math.max(...H.map(r => r.rounds)),
    tokensPerTask: avg(H.map(r => r.tokens)),
    naiveTokensPerTask: avg(N.map(r => r.tokens)),
    approvalsPerTask: Math.round((H.reduce((a, r) => a + r.approvals, 0) / H.length) * 10) / 10,
    incidentsNaive: N.reduce((a, r) => a + r.safety, 0),
  };
}

export const THREAT_CONCEPTS: ConceptId[] = ["inject", "tiers", "gate", "budget", "idem", "comp"];
