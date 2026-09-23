import { useEffect, useMemo, useRef, useState } from "react";
import type { ConceptId } from "../engine/concepts";
import type { Card } from "../engine/types";
import type { RunStatus } from "./RunUI";

/* The loop view: every harness is one loop, drawn as a track. Context goes in, the model decides,
   the harness checks, a tool runs, the result comes back, and the harness asks "stuck?" and
   "done?" before going round again. A bright head moves to the station of the latest step, so
   each model round is a lap; stations count what the harness handled (✓) and missed (✕) there.
   The timeline below stays the detailed view; this is the at-a-glance one. */

type StationId = "context" | "decide" | "guard" | "act" | "observe" | "loop" | "done";
type Place = { seg: "left" | "right" } | { seg: "top" | "bottom"; u: number };
interface Station { id: StationId; kind: "box" | "diamond"; title: string; sub: string; q?: string; qShort?: string; at: Place; concepts: ConceptId[] }

const STATIONS: Station[] = [
  { id: "context", kind: "box", title: "Context", sub: "what the model sees", at: { seg: "left" }, concepts: ["ctx", "mem", "compact", "steer"] },
  { id: "decide", kind: "diamond", title: "Decide", sub: "", q: "which tool?", qShort: "which tool?", at: { seg: "top", u: -0.66 }, concepts: ["loop", "parallel"] },
  { id: "guard", kind: "diamond", title: "Check", sub: "", q: "allowed to run?", qShort: "allowed?", at: { seg: "top", u: 0.22 }, concepts: ["tiers", "schema", "unknown", "gate", "budget", "inject"] },
  { id: "act", kind: "box", title: "Act", sub: "tool call", at: { seg: "right" }, concepts: ["retry", "timeout", "idem"] },
  { id: "observe", kind: "box", title: "Observe", sub: "read the result", at: { seg: "bottom", u: 0.55 }, concepts: ["comp", "subagent"] },
  { id: "loop", kind: "diamond", title: "Stuck", sub: "", q: "going in circles?", qShort: "stuck?", at: { seg: "bottom", u: -0.12 }, concepts: ["loopguard"] },
  { id: "done", kind: "diamond", title: "Done", sub: "", q: "really done?", qShort: "done?", at: { seg: "bottom", u: -0.72 }, concepts: ["stophook", "eval"] },
];

const STATION_OF_CONCEPT = Object.fromEntries(STATIONS.flatMap(s => s.concepts.map(c => [c, s.id]))) as Record<ConceptId, StationId>;

/** Which station a trace card belongs to. */
function stationOf(c: Card): StationId | "approve" {
  if (c.awaiting) return "approve";
  if (c.blocks.some(b => b.kind === "report" || b.kind === "score") || c.actor === "eval") return "done";
  if (c.variant === "context" || c.actor === "user") return "context";
  if (c.actor === "subagent") return "observe";
  if (c.actor === "model") {
    if (!c.code) return c.concepts.includes("stophook") ? "done" : "decide";
    return c.verdict.cls === "pending" ? "act" : "observe";
  }
  if (c.blocks.some(b => b.kind === "parallel")) return "act";
  for (const k of c.concepts) if (STATION_OF_CONCEPT[k]) return STATION_OF_CONCEPT[k];
  return "observe";
}

/* ---------- geometry: a stadium track, laid out wide or tall ---------- */

interface Geo { w: number; h: number; cx: number; cy: number; A: number; r: number; tall: boolean }
const WIDE: Geo = { w: 1000, h: 380, cx: 500, cy: 190, A: 480, r: 118, tall: false };
const TALL: Geo = { w: 420, h: 660, cx: 210, cy: 325, A: 390, r: 96, tall: true };

type P = { x: number; y: number };
const toScreen = (g: Geo, p: P): P => (g.tall ? { x: g.cx - p.y, y: g.cy + p.x } : { x: g.cx + p.x, y: g.cy + p.y });
const rot = (g: Geo, n: P): P => (g.tall ? { x: -n.y, y: n.x } : n);
const trackLen = (g: Geo) => 2 * g.A + 2 * Math.PI * g.r;

/** Point (local frame) at distance s along the centre line, pushed `off` outward, plus the outward normal. */
function local(g: Geo, s: number, off = 0): { p: P; n: P } {
  const { A, r } = g, L = trackLen(g), q = (Math.PI * r) / 2;
  s = ((s % L) + L) % L;
  let c: P, n: P;
  if (s < q) { const t = Math.PI + (s / q) * (Math.PI / 2); c = { x: -A / 2 + r * Math.cos(t), y: r * Math.sin(t) }; n = { x: Math.cos(t), y: Math.sin(t) }; }
  else if (s < q + A) { c = { x: -A / 2 + (s - q), y: -r }; n = { x: 0, y: -1 }; }
  else if (s < 3 * q + A) { const t = -Math.PI / 2 + ((s - q - A) / (2 * q)) * Math.PI; c = { x: A / 2 + r * Math.cos(t), y: r * Math.sin(t) }; n = { x: Math.cos(t), y: Math.sin(t) }; }
  else if (s < 3 * q + 2 * A) { c = { x: A / 2 - (s - 3 * q - A), y: r }; n = { x: 0, y: 1 }; }
  else { const t = Math.PI / 2 + ((s - 3 * q - 2 * A) / q) * (Math.PI / 2); c = { x: -A / 2 + r * Math.cos(t), y: r * Math.sin(t) }; n = { x: Math.cos(t), y: Math.sin(t) }; }
  return { p: { x: c.x + n.x * off, y: c.y + n.y * off }, n };
}
function at(g: Geo, s: number, off = 0) { const { p, n } = local(g, s, off); return { p: toScreen(g, p), n: rot(g, n) }; }

function sOf(g: Geo, place: Place) {
  const q = (Math.PI * g.r) / 2;
  if (place.seg === "left") return 0;
  if (place.seg === "right") return 2 * q + g.A;
  const u = "u" in place ? place.u : 0;
  if (place.seg === "top") return q + (u * g.A) / 2 + g.A / 2;
  return 3 * q + g.A + g.A / 2 - (u * g.A) / 2;
}
/** A point inside the track: u along the long axis, v across it. */
const inner = (g: Geo, u: number, v = 0) => toScreen(g, { x: (u * g.A) / 2, y: v });

function strandPath(g: Geo, off: number) {
  const L = trackLen(g), pts: string[] = [];
  for (let s = 0; s <= L + 1; s += 14) { const { p } = at(g, s, off); pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`); }
  return "M" + pts.join("L") + "Z";
}

function useTall() {
  const q = "(max-width: 700px)";
  const [tall, setTall] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q), f = () => setTall(m.matches);
    m.addEventListener("change", f); return () => m.removeEventListener("change", f);
  }, []);
  return tall;
}

/* ---------- component ---------- */

const STRANDS = [-15, -10, -6, -2, 2, 6, 10, 15];
const PARTICLES = 34;

export function LoopViz({ cards, hit, rounds, tokens, window: win, status, userLabel, modelLabel = "Model", approvals }: {
  cards: Card[]; hit: Partial<Record<ConceptId, "ok" | "miss">>; rounds: number; tokens: number; window: number; approvals?: number;
  status: RunStatus; userLabel: string; modelLabel?: string;
}) {
  const g = useTall() ? TALL : WIDE;
  const L = trackLen(g);
  const latest = cards[cards.length - 1];
  const waiting = cards.some(c => c.awaiting);
  const target: StationId | "approve" = status === "ready" || !latest ? "context" : stationOf(latest);
  const trackTarget: StationId = target === "approve" ? "guard" : target;
  const tone = !latest || status === "ready" ? "" : latest.verdict.cls === "danger" ? "bad" : latest.verdict.cls === "warn" ? "warn" : latest.verdict.cls === "success" ? "good" : "";
  const idle = status === "example" || status === "ready" || status === "finished" || status === "stopped" || status === "error";

  const calls = cards.filter(c => c.actor === "model" && c.code).length;
  const handled = Object.values(hit).filter(v => v === "ok").length;
  const missed = Object.values(hit).filter(v => v === "miss").length;
  const asked = approvals ?? cards.filter(c => c.blocks.some(b => b.kind === "choices")).length;

  const perStation = Object.fromEntries(STATIONS.map(s => {
    const ok = s.concepts.filter(c => hit[c] === "ok").length, miss = s.concepts.filter(c => hit[c] === "miss").length;
    return [s.id, { ok, miss }];
  }));

  const strands = useMemo(() => STRANDS.map(o => strandPath(g, o)), [g]);
  const stationS = useMemo(() => Object.fromEntries(STATIONS.map(s => [s.id, sOf(g, s.at)])) as Record<StationId, number>, [g]);

  // animation state lives in refs so a moving head doesn't re-render React
  const svgRef = useRef<SVGSVGElement>(null);
  const live = useRef({ target: stationS[trackTarget], idle, waiting, tone });
  live.current = { target: stationS[trackTarget], idle, waiting, tone };
  const head = useRef(stationS[trackTarget]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dots = Array.from(svg.querySelectorAll<SVGCircleElement>(".lp-p"));
    const trail = Array.from(svg.querySelectorAll<SVGCircleElement>(".lp-t"));
    const seeds = dots.map((_, i) => ({ s: (i / dots.length) * L + Math.random() * 40, off: STRANDS[i % STRANDS.length] + (Math.random() - 0.5) * 3, v: 0.6 + Math.random() * 0.9 }));
    let raf = 0, last = performance.now();
    const place = (el: SVGCircleElement, s: number, off: number) => { const { p } = at(g, s, off); el.setAttribute("cx", p.x.toFixed(1)); el.setAttribute("cy", p.y.toFixed(1)); };
    const frame = (now: number) => {
      const dt = Math.min(50, now - last) / 16.7; last = now;
      const st = live.current;
      // the head only ever moves forward, so a station behind it means another lap
      const d = (st.target - head.current + L) % L;
      if (reduce) head.current = st.target;
      else if (d > 0.5) head.current = (head.current + Math.min(d, Math.max(6, d * 0.12) * dt)) % L;
      trail.forEach((el, i) => place(el, head.current - i * 7, 0));
      const speed = reduce ? 0 : st.waiting ? 0.25 : st.idle ? 0.55 : 2.1;
      seeds.forEach((p, i) => { p.s = (p.s + p.v * speed * dt) % L; place(dots[i], p.s, p.off); });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [g, L]);

  const chip = inner(g, 0);
  const win2 = inner(g, g.tall ? -0.42 : -0.5);
  const approve = inner(g, g.tall ? 0.42 : 0.56);
  const ib = g.tall ? 48 : 62;
  const guardP = at(g, stationS.guard).p;
  const decideP = at(g, stationS.decide).p;
  const latestFor = (id: StationId) => target === id || (id === "guard" && target === "approve");
  const pct = Math.round((tokens / win) * 100);
  const recent = cards.filter(c => c.actor !== "eval").slice(-3);

  return (
    <div className={`loopviz is-${status}${waiting ? " is-waiting" : ""}`} aria-label="The agent loop, at a glance">
      <div className="lp-head">
        <div className="lp-title">
          <b>The loop</b>
          <span>context → decide → check → act → observe → stuck? → done?</span>
        </div>
        <dl className="lp-counters">
          <div><dt>Round</dt><dd>{rounds}</dd></div>
          <div><dt>Tool calls</dt><dd>{calls}</dd></div>
          <div><dt>Handled</dt><dd className="good">{handled}</dd></div>
          <div><dt>Missed</dt><dd className="bad">{missed}</dd></div>
          <div><dt>Asked {userLabel.toLowerCase() === "you" ? "you" : userLabel}</dt><dd>{asked}</dd></div>
        </dl>
      </div>

      <svg ref={svgRef} className="lp-svg" viewBox={`0 0 ${g.w} ${g.h}`} role="img"
        aria-label={`Round ${rounds}. The latest step is at ${target === "approve" ? "your approval" : target}.`}>
        <defs>
          <radialGradient id="lp-glow"><stop offset="0" stopColor="currentColor" stopOpacity=".55" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></radialGradient>
        </defs>
        <g className="lp-strands">{strands.map((d, i) => <path key={i} d={d} style={{ opacity: 0.1 + (i % 3) * 0.05 }} />)}</g>

        {/* spokes from the model chip */}
        <line className={"lp-spoke" + (target === "decide" ? " on" : "")} x1={chip.x} y1={chip.y} x2={decideP.x} y2={decideP.y} />
        <line className={"lp-spoke ask" + (target === "approve" ? " on" : "")} x1={guardP.x} y1={guardP.y} x2={approve.x} y2={approve.y} />

        <g className="lp-particles">{Array.from({ length: PARTICLES }, (_, i) => <circle key={i} className={"lp-p" + (i % 5 === 0 ? " hot" : "")} r={i % 5 === 0 ? 2.2 : 1.6} cx={-10} cy={-10} />)}</g>
        <g className={"lp-trail " + tone}>{Array.from({ length: 12 }, (_, i) => <circle key={i} className="lp-t" r={Math.max(1.2, 5 - i * 0.35)} style={{ opacity: 1 - i / 12 }} cx={-10} cy={-10} />)}</g>

        {STATIONS.map(s => {
          const { p, n } = at(g, stationS[s.id]);
          const c = perStation[s.id];
          const on = latestFor(s.id) && status !== "ready";
          const cls = ["lp-st", "k-" + s.kind, on ? "on " + tone : "", c.miss ? "has-miss" : c.ok ? "has-ok" : ""].join(" ");
          const count = c.ok || c.miss ? `${c.ok ? "✓" + c.ok : ""}${c.ok && c.miss ? " " : ""}${c.miss ? "✕" + c.miss : ""}` : "";
          if (s.kind === "box") {
            const w = g.tall ? 96 : 124, h = 44;
            return (
              <g key={s.id} className={cls} transform={`translate(${p.x},${p.y})`}>
                {on && <circle className="lp-halo" r="46" />}
                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="9" />
                <text className="lp-st-title" y="-2" textAnchor="middle">{s.title}</text>
                <text className="lp-st-sub" y="13" textAnchor="middle">{s.id === "act" && on && latest?.code ? latest.code.replace(/\(.*$/s, "") .slice(0, 20) : count || s.sub}</text>
              </g>
            );
          }
          const lx = n.x * (g.tall ? 32 : 40), ly = n.y * 40;
          const anchor = n.x > 0.5 ? "start" : n.x < -0.5 ? "end" : "middle";
          return (
            <g key={s.id} className={cls} transform={`translate(${p.x},${p.y})`}>
              {on && <circle className="lp-halo" r="40" />}
              {on && tone === "bad" && <circle key={latest?.id} className="lp-burst" r="20" />}
              <rect x="-17" y="-17" width="34" height="34" rx="4" transform="rotate(45)" />
              <text className="lp-dia" y="3.5" textAnchor="middle">{count || "·"}</text>
              <text className="lp-q" x={lx} y={ly + (n.y > 0.5 ? 10 : n.y < -0.5 ? -2 : 4)} textAnchor={anchor}>{g.tall ? s.qShort : s.q}</text>
            </g>
          );
        })}

        {/* inside the track: the context window, the model chip, and you */}
        <g className="lp-win" transform={`translate(${win2.x},${win2.y})`}>
          <rect x={-ib} y="-22" width={ib * 2} height="44" rx="9" />
          <text className="lp-st-title" y="-3" textAnchor="middle">{pct}%</text>
          <text className="lp-st-sub" y="12" textAnchor="middle">{g.tall ? "context" : "context window"}</text>
          <rect className="lp-win-bar" x={-ib + 16} y="16" width={ib * 2 - 32} height="3" rx="1.5" />
          <rect className={"lp-win-fill" + (pct > 90 ? " bad" : pct > 75 ? " warn" : "")} x={-ib + 16} y="16" width={Math.min(ib * 2 - 32, ((ib * 2 - 32) * pct) / 100)} height="3" rx="1.5" />
        </g>

        <g className={"lp-chip" + (target === "decide" ? " on" : "")} transform={`translate(${chip.x},${chip.y})`}>
          {[-18, -6, 6, 18].map(o => <g key={o}><line x1={o} y1="-44" x2={o} y2="-36" /><line x1={o} y1="36" x2={o} y2="44" /><line x1="-44" y1={o} x2="-36" y2={o} /><line x1="36" y1={o} x2="44" y2={o} /></g>)}
          <rect x="-36" y="-36" width="72" height="72" rx="10" />
          <text className="lp-chip-name" y="2" textAnchor="middle">{modelLabel}</text>
          <text className="lp-chip-sub" y="18" textAnchor="middle">round {rounds}</text>
        </g>

        <g className={"lp-you" + (target === "approve" ? " on" : "")} transform={`translate(${approve.x},${approve.y})`}>
          <rect x={-ib} y="-22" width={ib * 2} height="44" rx="9" />
          <text className="lp-st-title" y="-2" textAnchor="middle">{target === "approve" ? "You decide" : g.tall ? "You" : "You approve"}</text>
          <text className="lp-st-sub" y="13" textAnchor="middle">{target === "approve" ? (g.tall ? "waiting ↓" : "waiting below ↓") : `${asked} asked`}</text>
        </g>
      </svg>

      <ol className="lp-log" aria-label="Latest steps">
        {recent.length ? recent.map(c => {
          const st = stationOf(c);
          const v = c.verdict.cls === "danger" ? "bad" : c.verdict.cls === "warn" ? "warn" : c.verdict.cls === "success" ? "good" : "";
          return (
            <li key={c.id} className={v}>
              <span className="lp-tag">{st === "approve" ? "you" : st}</span>
              <span className="lp-text">{c.code ? c.code.replace(/\(.*$/s, "()") : c.title ?? (c.actor === "model" ? "Model" : "")}{c.verdict.text ? " · " + c.verdict.text.split(/(?<=\.)\s/)[0] : ""}</span>
            </li>
          );
        }) : <li><span className="lp-tag">ready</span><span className="lp-text">Press run and watch the head go round, one lap per model round.</span></li>}
      </ol>
    </div>
  );
}
