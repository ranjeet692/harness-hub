import { useEffect, useRef, type ReactNode } from "react";
import { CONCEPT_BY_ID } from "../engine/concepts";
import type { Card, GoalStatus } from "../engine/types";

/* Pieces shared by the scripted and live consoles. */

export type RunStatus = "example" | "ready" | "running" | "waiting" | "finished" | "stopped" | "error";

const STATUS_LABEL: Record<RunStatus, string> = {
  example: "Example run", ready: "Ready", running: "Running", waiting: "Waiting for you",
  finished: "Finished", stopped: "Stopped", error: "Error",
};

const ACTOR = { model: "Model", harness: "Harness", user: "You", subagent: "Subagent", eval: "Scorecard" } as const;

/** One plain-language line about the latest step in the run. */
export function describeLatest(cards: Card[], userLabel: string) {
  const c = [...cards].reverse().find(x => x.actor !== "eval") ?? cards[cards.length - 1];
  if (!c) return "";
  const who = c.actor === "user" ? userLabel : ACTOR[c.actor];
  const what = c.code ? c.code.replace(/\(.*$/s, "()") : c.title ?? "";
  const verdict = c.verdict.text.split(/(?<=\.)\s/)[0];
  return `${who}${what ? " · " + what : ""}: ${verdict}`;
}

export function Section({ n, title, lead, children, id, aside }: { n: number; title: string; lead: string; children: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <section className="step-section" id={id} aria-labelledby={`sec-${n}`}>
      <header className="step-head">
        <span className="step-n" aria-hidden="true">{n}</span>
        <div>
          <h2 id={`sec-${n}`}>{title}</h2>
          <p>{lead}</p>
        </div>
        {aside && <div className="step-aside">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

const GOAL_TONE: Record<GoalStatus, "" | "good" | "warn" | "bad" | "info"> = {
  pending: "", active: "info", done: "good", fallback: "good", partial: "warn", failed: "bad", declined: "info", skipped: "bad",
};

/** Sticky bar that always says what the run is doing right now. */
export function RunBar({ status, round, latest, goals, goalLabels, actions }: {
  status: RunStatus; round: number; latest: string;
  goals: Record<string, GoalStatus>; goalLabels: { id: string; label: string }[]; actions: ReactNode;
}) {
  const met = goalLabels.filter(g => ["done", "fallback"].includes(goals[g.id])).length;
  return (
    <div className={"runbar is-" + status} role="status" aria-live="polite">
      <div className="runbar-inner">
        <span className="runbar-status"><span className="dot" aria-hidden="true" />{STATUS_LABEL[status]}</span>
        <div className="runbar-now">
          {round > 0 && <span className="runbar-round">Round {round}</span>}
          <span className="runbar-text">{latest || "Press Run to start. Each step will appear below as it happens."}</span>
        </div>
        <div className="runbar-goals" aria-label={`${met} of ${goalLabels.length} goals met`}>
          <span className="runbar-goals-n">{met}/{goalLabels.length} goals</span>
          <span className="runbar-segs" aria-hidden="true">
            {goalLabels.map(g => <i key={g.id} className={GOAL_TONE[goals[g.id] ?? "pending"]} title={`${g.label}: ${goals[g.id] ?? "pending"}`} />)}
          </span>
        </div>
        <div className="runbar-actions">{actions}</div>
      </div>
    </div>
  );
}

/** When the run pauses for a person, the question comes to them instead of hiding in the trace. */
export function DecisionSheet({ cards, onChoose, onShow }: { cards: Card[]; onChoose(cardId: number, optionId: string): void; onShow(cardId: number): void }) {
  const card = cards.find(c => c.awaiting);
  const choices = card?.blocks.find(b => b.kind === "choices") as Extract<Card["blocks"][number], { kind: "choices" }> | undefined;
  const first = useRef<HTMLButtonElement>(null);
  const cardId = card?.id;

  useEffect(() => {
    if (!cardId) return;
    const prev = document.title;
    document.title = "Waiting for you · " + prev.replace(/^Waiting for you · /, "");
    first.current?.focus({ preventScroll: true });
    return () => { document.title = prev.replace(/^Waiting for you · /, ""); };
  }, [cardId]);

  if (!card || !choices) return null;
  const concept = card.concepts.find(c => c === "gate") ?? card.concepts[0];
  const details = card.blocks.filter(b => b.kind === "detail").map(b => (b as { text: string }).text);
  return (
    <div className="decision" role="dialog" aria-modal="false" aria-labelledby="decision-title" aria-describedby="decision-text">
      <div className="decision-card">
        <div className="decision-top">
          <span className="decision-badge">Paused · needs your decision</span>
          <button type="button" className="link" onClick={() => onShow(card.id)}>Show in timeline</button>
        </div>
        <h3 id="decision-title">{card.title ?? "Approval needed"}</h3>
        <p id="decision-text">{card.verdict.text}</p>
        {details.map((d, i) => <p key={i} className="decision-detail">{d}</p>)}
        {concept && <p className="decision-why"><b>Why you're asked:</b> {CONCEPT_BY_ID[concept].summary}</p>}
        <div className="decision-actions">
          {choices.options.map((o, i) => (
            <button key={o.id} ref={i === 0 ? first : undefined} type="button" className={"btn " + (i === 0 ? "btn-primary" : "btn-secondary")} data-choice={o.id} onClick={() => onChoose(card.id, o.id)}>{o.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SidePanel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="side-panel">
      <h3>{title}</h3>
      {hint && <p className="side-hint">{hint}</p>}
      {children}
    </div>
  );
}

export const GOAL_PILL: Record<GoalStatus, [string, string]> = {
  pending: ["Not yet", ""], active: ["Working", "info"], done: ["Done", "good"], fallback: ["Done via fallback", "good"],
  partial: ["Partly", "warn"], failed: ["Failed", "bad"], declined: ["You declined", "info"], skipped: ["Not reached", "bad"],
};

export function toneOf(t: string) { return t === "danger" ? "bad" : t; }

/** Who's who in the timeline. */
export function ActorLegend({ userLabel }: { userLabel: string }) {
  return (
    <ul className="actor-legend" aria-label="Who's who in the timeline">
      <li className="actor-model"><span className="step-mark">M</span>Model decides</li>
      <li className="actor-harness"><span className="step-mark">H</span>Harness checks</li>
      <li className="actor-user"><span className="step-mark">Y</span>{userLabel === "You" ? "You" : userLabel}</li>
      <li className="actor-subagent"><span className="step-mark">S</span>Subagent</li>
    </ul>
  );
}
