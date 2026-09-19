/** The harness loop: context → model → tools → loop control, with evals watching. */
export function LoopFigure() {
  return (
    <figure className="loop-fig">
      <svg viewBox="0 0 520 320" role="img" aria-labelledby="loop-title loop-desc">
        <title id="loop-title">The agent harness loop</title>
        <desc id="loop-desc">The harness assembles context, the model decides, tools act and report back, and loop control decides whether to continue. Evaluations score every run.</desc>
        <defs>
          <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        <rect x="8" y="58" width="504" height="254" rx="20" className="fig-harness" />
        <text x="24" y="80" className="fig-label">The harness</text>

        <rect x="170" y="6" width="180" height="40" rx="10" className="fig-eval" />
        <text x="260" y="24" textAnchor="middle" className="fig-title">Evals</text>
        <text x="260" y="39" textAnchor="middle" className="fig-sub">score every run</text>
        <line x1="260" y1="46" x2="260" y2="128" className="fig-dash" />

        <circle cx="260" cy="178" r="48" className="fig-model" />
        <text x="260" y="176" textAnchor="middle" className="fig-title">Model</text>
        <text x="260" y="192" textAnchor="middle" className="fig-sub">decides</text>

        <rect x="26" y="150" width="132" height="58" rx="12" className="fig-box" />
        <text x="92" y="175" textAnchor="middle" className="fig-title">Context</text>
        <text x="92" y="192" textAnchor="middle" className="fig-sub">rules · memory · state</text>

        <rect x="362" y="150" width="132" height="58" rx="12" className="fig-box" />
        <text x="428" y="175" textAnchor="middle" className="fig-title">Tools</text>
        <text x="428" y="192" textAnchor="middle" className="fig-sub">act · observe</text>

        <rect x="186" y="248" width="148" height="52" rx="12" className="fig-box" />
        <text x="260" y="270" textAnchor="middle" className="fig-title">Loop control</text>
        <text x="260" y="286" textAnchor="middle" className="fig-sub">guards · gates · stop hook</text>

        <line x1="160" y1="179" x2="208" y2="179" className="fig-arrow" markerEnd="url(#ah)" />
        <line x1="310" y1="179" x2="358" y2="179" className="fig-arrow" markerEnd="url(#ah)" />
        <path d="M428 210 Q428 274 338 274" className="fig-arrow" markerEnd="url(#ah)" />
        <path d="M184 274 Q92 274 92 212" className="fig-arrow" markerEnd="url(#ah)" />
      </svg>
      <figcaption>Every card in a trace is one of these steps. The model only decides; everything around it is the harness.</figcaption>
    </figure>
  );
}
