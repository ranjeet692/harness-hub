import { CONCEPT_BY_ID, type ConceptId } from "../engine/concepts";
import type { Card } from "../engine/types";

const ACTOR_LABEL = { model: "Model", harness: "Harness", user: "You", subagent: "Subagent", eval: "Eval" } as const;

interface Props {
  card: Card;
  userLabel: string;
  flash: boolean;
  onConcept(id: ConceptId): void;
  onChoose(cardId: number, optionId: string): void;
}

/** One entry in the trace: a model round, a harness intervention, a user message, and so on. */
export function TraceCard({ card, userLabel, flash, onConcept, onChoose }: Props) {
  const cls = ["card", card.variant ?? "", card.awaiting ? "awaiting" : "", flash ? "flash" : ""].filter(Boolean).join(" ");
  return (
    <article className={cls} data-card={card.id}>
      <div className="card-head">
        <span className={"actor actor-" + card.actor}>{card.actor === "user" ? userLabel : ACTOR_LABEL[card.actor]}</span>
        {card.title && <span className="round-tag">{card.title}</span>}
      </div>
      {card.code && <code className="tool-call">{card.code}</code>}
      {card.pre && <pre className="tool-call">{card.pre}</pre>}
      <p className={"verdict " + card.verdict.cls}>{card.verdict.text}</p>
      {card.blocks.map((b, i) => {
        switch (b.kind) {
          case "detail": case "progress": return b.text ? <p key={i} className="detail">{b.text}</p> : null;
          case "note": return <p key={i} className="note">{b.text}</p>;
          case "text": return <p key={i} className="assistant-text">{b.text}</p>;
          case "quote": return (
            <div key={i} className="quote">“{b.plain}{b.injected && <> <mark>{b.injected}</mark></>}”</div>
          );
          case "parallel": return (
            <ul key={i} className="par">
              {b.rows.map(r => <li key={r.id}><code>{r.code}</code><span className={"pill " + r.tone}>{r.status}</span></li>)}
            </ul>
          );
          case "report": return (
            <ul key={i} className="report">
              {b.lines.map(([c, t], j) => <li key={j} className={c}>{t}</li>)}
            </ul>
          );
          case "score": return (
            <dl key={i} className="score">
              {b.metrics.map(m => (
                <div key={m.label}><dt>{m.label}</dt><dd className={m.good === true ? "good" : m.good === false ? "bad" : ""}>{m.value}</dd></div>
              ))}
            </dl>
          );
          case "choices": return (
            <div key={i} className="choices">
              {b.options.map((o, j) => (
                <button key={o.id} type="button" className={"btn-choice" + (j === 0 ? " primary" : "")} data-choice={o.id} onClick={() => onChoose(card.id, o.id)}>{o.label}</button>
              ))}
            </div>
          );
        }
      })}
      {card.concepts.length > 0 && (
        <div className="tags">
          {card.concepts.map(id => (
            <button key={id} type="button" className="tag" onClick={() => onConcept(id)}>{CONCEPT_BY_ID[id].label}</button>
          ))}
        </div>
      )}
    </article>
  );
}
