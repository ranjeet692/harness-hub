import type { RunState } from "../../engine/types";
import { BRIEF_ITEMS, coverageOf, type Check, type DEdge, type DNode, type Doc } from "./model";

/* The diagram editor the agent works in: a canvas you could drag shapes around on, a
   checks panel that shows what verification sees, and a prompt bar for edits in words.
   Everything is drawn from the run state, so it changes as the agent works. */

const W = 760, COLW = 196, ROWH = 64, TOP = 34;
const X = (col: number) => W / 2 + col * COLW;
const Y = (row: number) => TOP + row * ROWH;
const SIZE: Record<DNode["type"], [number, number]> = { start: [176, 36], end: [150, 36], step: [184, 40], decision: [186, 50] };

function edgePath(a: DNode, b: { col: number; row: number; type?: DNode["type"] }) {
  const ax = X(a.col), ay = Y(a.row) + SIZE[a.type][1] / 2;
  const bh = b.type ? SIZE[b.type][1] : 40;
  const bx = X(b.col), by = Y(b.row) - bh / 2;
  if (Math.abs(ax - bx) < 1) return { d: `M${ax},${ay} V${by}`, lx: ax, ly: (ay + by) / 2 };
  if (b.row <= a.row + 0.01) {
    // sideways: leave from the side, come in from the side
    const sx = ax + (bx > ax ? SIZE[a.type][0] / 2 : -SIZE[a.type][0] / 2);
    const ex = bx + (bx > ax ? -(b.type ? SIZE[b.type][0] : 160) / 2 : (b.type ? SIZE[b.type][0] : 160) / 2);
    const y1 = Y(a.row), y2 = Y(b.row);
    return { d: `M${sx},${y1} H${(sx + ex) / 2} V${y2} H${ex}`, lx: (sx + ex) / 2, ly: (y1 + y2) / 2 };
  }
  if (a.type === "decision") {
    // decisions branch out of their left and right points
    const sx = ax + (bx > ax ? SIZE.decision[0] / 2 : -SIZE.decision[0] / 2);
    const sy = Y(a.row);
    return { d: `M${sx},${sy} H${bx} V${by}`, lx: (sx + bx) / 2, ly: sy - 9 };
  }
  const my = by - 14;
  return { d: `M${ax},${ay} V${my} H${bx} V${by}`, lx: (ax + bx) / 2, ly: my - 8 };
}

function Shape({ n, focused }: { n: DNode; focused: boolean }) {
  const [w, h] = SIZE[n.type];
  const x = X(n.col), y = Y(n.row);
  const cls = ["dg-node", "t-" + n.type, n.pin ? "pinned" : "", n.flag ? "f-" + n.flag : "", focused ? "focused" : ""].filter(Boolean).join(" ");
  return (
    <g className={cls} transform={`translate(${x},${y})`}>
      {n.type === "decision"
        ? <polygon points={`0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`} />
        : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={n.type === "step" ? 7 : h / 2} />}
      <text className="dg-label" textAnchor="middle" dominantBaseline="central">{n.label.length > 31 ? n.label.slice(0, 30) + "…" : n.label}</text>
      {focused && (
        <g className="dg-sel">
          <rect x={-w / 2 - 6} y={-h / 2 - 6} width={w + 12} height={h + 12} rx={4} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => <rect key={`${sx}${sy}`} className="dg-handle" x={sx * (w / 2 + 6) - 3.5} y={sy * (h / 2 + 6) - 3.5} width={7} height={7} />)}
          <g transform={`translate(${w / 2 + 10},${-h / 2 - 16})`} className="dg-cursor">
            <path d="M0,0 L0,13 L4,9.5 L7,16 L9.5,15 L6.5,8.5 L11,8.5 Z" />
            <rect x={12} y={6} width={42} height={16} rx={4} />
            <text x={33} y={17.5} textAnchor="middle">Agent</text>
          </g>
        </g>
      )}
      {n.pin && (
        <g className="dg-pin" transform={`translate(${-w / 2 + 2},${-h / 2 - 2})`}>
          <circle r={7} /><path d="M-2.5,-2.5 L2.5,2.5 M2.5,-2.5 L-2.5,2.5" transform="rotate(45)" />
        </g>
      )}
      {n.flag === "invented" && <text className="dg-tag warn" x={0} y={-h / 2 - 7} textAnchor="middle">not in brief</text>}
    </g>
  );
}

function Flow({ doc }: { doc: Doc }) {
  const byId = Object.fromEntries(doc.nodes.map(n => [n.id, n]));
  const maxRow = Math.max(8, ...doc.nodes.map(n => n.row));
  const H = Y(maxRow) + 44;
  return (
    <svg className="dg-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Flowchart with ${doc.nodes.length} shapes and ${doc.edges.length} arrows`}>
      <defs>
        <pattern id="dg-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className="dg-dot" /></pattern>
        <marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="dg-arrowhead" /></marker>
        <marker id="dg-arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="dg-arrowhead bad" /></marker>
      </defs>
      <rect width={W} height={H} fill="url(#dg-dots)" />
      {doc.edges.map((e: DEdge, i) => {
        const a = byId[e.from];
        if (!a) return null;
        const b = byId[e.to];
        const target = b ?? { col: a.col + 1, row: a.row + 1.2 };
        const p = edgePath(a, target);
        return (
          <g key={i} className={"dg-edge" + (b ? "" : " dangling")}>
            <path d={p.d} markerEnd={b ? "url(#dg-arrow)" : "url(#dg-arrow-bad)"} />
            {e.label && <g transform={`translate(${p.lx},${p.ly})`}><rect x={-14} y={-8} width={28} height={16} rx={4} className="dg-elabel-bg" /><text className="dg-elabel" textAnchor="middle" dominantBaseline="central">{e.label}</text></g>}
            {!b && (
              <g transform={`translate(${X(target.col)},${Y(target.row)})`} className="dg-ghost">
                <rect x={-60} y={-18} width={120} height={36} rx={7} />
                <text textAnchor="middle" dominantBaseline="central">“{e.to}” ?</text>
              </g>
            )}
          </g>
        );
      })}
      {doc.nodes.map(n => <Shape key={n.id} n={n} focused={doc.focus === n.id} />)}
    </svg>
  );
}

function Sequence({ doc }: { doc: Doc }) {
  const SW = 760, gap = SW / (doc.actors.length + 1);
  const ax = (a: string) => gap * (doc.actors.indexOf(a) + 1);
  const H = 110 + doc.msgs.length * 54;
  return (
    <svg className="dg-svg" viewBox={`0 0 ${SW} ${H}`} role="img" aria-label={`Sequence diagram with ${doc.actors.length} participants and ${doc.msgs.length} messages`}>
      <defs>
        <pattern id="dg-dots2" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className="dg-dot" /></pattern>
        <marker id="dg-arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="dg-arrowhead" /></marker>
      </defs>
      <rect width={SW} height={H} fill="url(#dg-dots2)" />
      {doc.actors.map(a => (
        <g key={a} className="dg-actor">
          <line x1={ax(a)} x2={ax(a)} y1={52} y2={H - 12} />
          <rect x={ax(a) - 58} y={16} width={116} height={34} rx={7} />
          <text x={ax(a)} y={33} textAnchor="middle" dominantBaseline="central">{a}</text>
        </g>
      ))}
      {doc.msgs.map((m, i) => {
        const y = 86 + i * 54, x1 = ax(m.from), x2 = ax(m.to);
        return (
          <g key={i} className="dg-msg">
            {m.from === m.to
              ? <path d={`M${x1},${y} h36 v18 h-34`} markerEnd="url(#dg-arrow2)" />
              : <line x1={x1} x2={x2 + (x2 > x1 ? -3 : 3)} y1={y} y2={y} markerEnd="url(#dg-arrow2)" />}
            <text x={m.from === m.to ? x1 + 44 : (x1 + x2) / 2} y={y - 7} textAnchor={m.from === m.to ? "start" : "middle"}>{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

const ICON: Record<string, string> = {
  select: "M5 3l12 8-5 1 3 6-2 1-3-6-4 3z", hand: "M8 12V5a1.5 1.5 0 013 0v6m0-1V4a1.5 1.5 0 013 0v7m0-2a1.5 1.5 0 013 0v5a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2-4a1.5 1.5 0 012.5-1.5L8 14",
  rect: "M4 6h16v12H4z", diamond: "M12 3l9 9-9 9-9-9z", arrow: "M4 20L20 4M12 4h8v8", text: "M5 5h14M12 5v14",
};

export function CanvasScene({ S }: { S: RunState }) {
  const doc = S.doc as Doc;
  const cov = coverageOf(doc);
  const lint = (S.lint ?? []) as Check[];
  const nowTool = S.finished ? "" : S.now?.tool ?? "";
  const pins = doc.kind === "flow" ? doc.nodes.filter(n => n.id === "support" || n.id === "escalate") : [];
  const status = S.published === 2 ? "v4 + v5 published" : S.published === 1 ? `v${S.version} published` : `v${S.version} · draft`;
  return (
    <div className="dg" role="region" aria-label="Diagram editor showing the agent's work">
      <div className="dg-top">
        <span className="dg-logo" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 3l8 8-8 8-8-8z" /></svg></span>
        <span className="dg-file"><b>Refund flow</b><span>Handbook / Refunds</span></span>
        <div className="dg-tabs" role="tablist" aria-label="Views">
          <span role="tab" aria-selected={doc.kind === "flow"}>Flowchart</span>
          {(S.seqView || doc.kind === "sequence") && <span role="tab" aria-selected={doc.kind === "sequence"}>Sequence</span>}
        </div>
        <span className={"dg-ver" + (S.published === 2 ? " bad" : S.published ? " good" : "")}>{status}</span>
        <span className="dg-publish" aria-hidden="true">Publish</span>
      </div>
      <div className="dg-body">
        <div className="dg-tools" aria-hidden="true">
          {Object.entries(ICON).map(([k, d], i) => (
            <span key={k} className={i === 0 ? "on" : ""}><svg viewBox="0 0 24 24" width="17" height="17"><path d={d} /></svg></span>
          ))}
        </div>
        <div className="dg-canvas">
          {doc.kind === "sequence" ? <Sequence doc={doc} /> : <Flow doc={doc} />}
          {S.restyled && <div className="dg-banner bad">Every shape restyled · 4 swimlanes · legend</div>}
          {S.deleted > 0 && <div className="dg-banner bad" style={{ top: S.restyled ? 44 : 12 }}>2 other diagrams deleted from the workspace</div>}
        </div>
        <aside className="dg-side" aria-label="What verification sees">
          <section>
            <h4>Brief <span>{cov.filter(Boolean).length}/8</span></h4>
            <ul className="dg-brief">
              {BRIEF_ITEMS.map((b, i) => <li key={b} className={cov[i] ? "ok" : ""}><i aria-hidden="true">{cov[i] ? "✓" : ""}</i>{b}</li>)}
            </ul>
          </section>
          <section>
            <h4>Checks</h4>
            {lint.length === 0
              ? <p className="dg-muted">Not run yet</p>
              : <ul className="dg-checks">{lint.map((l, i) => <li key={i} className={l.level}><i aria-hidden="true">{l.level === "ok" ? "✓" : l.level === "info" ? "i" : "!"}</i>{l.text}</li>)}</ul>}
          </section>
          {pins.length > 0 && (
            <section>
              <h4>Your edits</h4>
              <ul className="dg-checks">
                {pins.map(p => (
                  <li key={p.id} className={p.pin ? "ok" : "bad"}>
                    <i aria-hidden="true">{p.pin ? "✓" : "!"}</i>
                    {p.id === "support" ? (p.pin ? "Renamed: “Support reviews order (24h SLA)”" : "Your rename was overwritten") : (p.pin ? "Moved: the escalate box" : "Your moved box was snapped back")}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
      <div className="dg-prompt">
        <span className="dg-spark" aria-hidden="true">✦</span>
        <span className="dg-prompt-text">{S.prompt}</span>
        <span className={"dg-agent" + (nowTool ? " on" : "")}>{nowTool ? nowTool : S.finished ? "done" : "idle"}</span>
      </div>
    </div>
  );
}
