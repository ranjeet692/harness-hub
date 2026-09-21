import { useState } from "react";
import { CONCEPT_BY_ID, type ConceptId } from "../engine/concepts";
import type { Card } from "../engine/types";

const ACTOR_LABEL = { model: "Model", harness: "Harness", user: "You", subagent: "Subagent", eval: "Scorecard" } as const;
const ACTOR_MARK = { model: "M", harness: "H", user: "Y", subagent: "S", eval: "✓" } as const;
const VERDICT_ICON = { success: "✓", warn: "!", danger: "✕", info: "", pending: "…" } as const;

interface Props {
  card: Card;
  userLabel: string;
  flash: boolean;
  onConcept(id: ConceptId): void;
  onChoose(cardId: number, optionId: string): void;
}

/** One step in the timeline: a model round, a harness check, a message from you, the scorecard. */
export function TraceCard({ card, userLabel, flash, onConcept, onChoose }: Props) {
  const [open, setOpen] = useState(false);
  const cls = ["step", "actor-" + card.actor, card.variant ?? "", card.awaiting ? "awaiting" : "", flash ? "flash" : "", "v-" + card.verdict.cls].filter(Boolean).join(" ");
  return (
    <li className={cls} data-card={card.id}>
      <span className="step-mark" aria-hidden="true">{ACTOR_MARK[card.actor]}</span>
      <article className="step-body">
        <header className="step-meta">
          <span className="step-actor">{card.actor === "user" ? userLabel : ACTOR_LABEL[card.actor]}</span>
          {card.title && <span className="step-title">{card.title}</span>}
          {card.awaiting && <span className="step-wait">Waiting for you</span>}
        </header>
        {card.code && <code className="step-call">{card.code}</code>}
        {card.pre && (
          <>
            <button type="button" className="link step-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? "Hide" : "Show"} what the model sees</button>
            {open && <pre className="step-pre">{card.pre}</pre>}
          </>
        )}
        <p className={"step-verdict " + card.verdict.cls}>
          {VERDICT_ICON[card.verdict.cls] && <span className="vi" aria-hidden="true">{VERDICT_ICON[card.verdict.cls]}</span>}
          {card.verdict.text}
        </p>
        {card.blocks.map((b, i) => {
          switch (b.kind) {
            case "detail": case "progress": return b.text ? <p key={i} className="step-detail">{b.text}</p> : null;
            case "note": return <p key={i} className="step-note">{b.text}</p>;
            case "text": return <p key={i} className="step-text">{b.text}</p>;
            case "quote": return (
              <blockquote key={i} className="step-quote">{b.plain}{b.injected && <> <mark title="Hidden instruction inside untrusted text">{b.injected}</mark></>}</blockquote>
            );
            case "parallel": return (
              <ul key={i} className="step-par">
                {b.rows.map(r => <li key={r.id}><code>{r.code}</code><span className={"chip " + (r.tone === "danger" ? "bad" : r.tone)}>{r.status}</span></li>)}
              </ul>
            );
            case "report": return (
              <ul key={i} className="step-report">
                {b.lines.map(([c, t], j) => <li key={j} className={c}><span className="ri" aria-hidden="true">{c === "ok" ? "✓" : c === "caveat" ? "!" : "✕"}</span>{t}{c === "false" && <em> · not true</em>}</li>)}
              </ul>
            );
            case "score": return (
              <dl key={i} className="step-score">
                {b.metrics.map(m => (
                  <div key={m.label}><dt>{m.label}</dt><dd className={m.good === true ? "good" : m.good === false ? "bad" : ""}>{m.value}</dd></div>
                ))}
              </dl>
            );
            case "choices": return (
              <div key={i} className="step-choices">
                {b.options.map((o, j) => (
                  <button key={o.id} type="button" className={"btn btn-sm " + (j === 0 ? "btn-primary" : "btn-secondary")} data-choice={o.id} onClick={() => onChoose(card.id, o.id)}>{o.label}</button>
                ))}
              </div>
            );
          }
        })}
        {card.concepts.length > 0 && (
          <div className="step-tags">
            {card.concepts.map(id => (
              <button key={id} type="button" className="tag" onClick={() => onConcept(id)}>{CONCEPT_BY_ID[id].label}</button>
            ))}
          </div>
        )}
      </article>
    </li>
  );
}
