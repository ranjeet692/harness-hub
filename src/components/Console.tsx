import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CONCEPTS, CONCEPT_BY_ID, GROUPS, type ConceptId } from "../engine/concepts";
import { k } from "../engine/format";
import { Run, allSwitches, runInstant } from "../engine/run";
import type { Domain, GoalStatus, Mode, RunResult, RunState } from "../engine/types";
import { href } from "../router";
import { TraceCard } from "./TraceCard";

const GOAL_PILL: Record<GoalStatus, [string, string]> = {
  pending: ["Pending", ""], active: ["Working", "info"], done: ["Done", "good"], fallback: ["Via fallback", "warn"],
  partial: ["Partial", "warn"], failed: ["Failed", "danger"], declined: ["Declined", "info"], skipped: ["Not reached", "danger"],
};

type Results = Partial<Record<Mode, RunResult>>;

/** The scripted harness console: controls, concept board, world state, trace and comparison. */
export function Console({ domain, focusConcept }: { domain: Domain; focusConcept?: ConceptId }) {
  const [mode, setMode] = useState<Mode>("hardened");
  const [sw, setSw] = useState<Record<string, boolean>>(() => allSwitches(domain));
  const [fast, setFast] = useState(false);
  const [run, setRun] = useState<Run>(() => new Run(domain, { mode: "hardened", sw: allSwitches(domain), instant: true }));
  const [results, setResults] = useState<Results>({});
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [example, setExample] = useState(true);
  const [selected, setSelected] = useState<ConceptId | null>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  useSyncExternalStore(run.subscribe, run.getVersion);

  // Worked example on load: naive first (fills the comparison), then hardened (shown).
  useEffect(() => {
    let alive = true;
    (async () => {
      const all = allSwitches(domain);
      const n = await runInstant(domain, "naive", all);
      const h = await runInstant(domain, "hardened", all);
      if (!alive) return;
      setResults({ naive: n.result!, hardened: h.result! });
      setRun(h); setExample(true); setReady(false);
      if (focusConcept) setSelected(focusConcept);
    })();
    return () => { alive = false; };
  }, [domain, focusConcept]);

  useEffect(() => () => run.abort(), [run]);

  // Scroll the trace to the first card tagged with the selected concept.
  useEffect(() => {
    if (!selected || !traceRef.current) return;
    const card = run.cards.find(c => c.concepts.includes(selected));
    const el = card && traceRef.current.querySelector<HTMLElement>(`[data-card="${card.id}"]`);
    if (el) traceRef.current.scrollTop = el.offsetTop - traceRef.current.offsetTop - 8;
  }, [selected, run]);

  function prepare(nextMode = mode, nextSw = sw) {
    if (running) return;
    setRun(new Run(domain, { mode: nextMode, sw: nextSw, instant: true }));
    setReady(true); setExample(false); setSelected(null);
  }

  async function start() {
    if (running) return;
    const r = new Run(domain, { mode, sw, fast });
    setRun(r); setReady(false); setExample(false); setRunning(true); setSelected(null);
    const result = await r.start();
    if (result) setResults(prev => ({ ...prev, [mode]: result }));
    setRunning(false);
  }

  const S = run.S;
  const onCount = domain.switches.filter(s => sw[s.id]).length;

  return (
    <section className="console" aria-label={`${domain.shortTitle} harness console`}>
      <div className="controls">
        <div className="field">
          <span className="field-label">Harness</span>
          <div className="segmented" role="radiogroup" aria-label="Harness mode">
            {(["hardened", "naive"] as Mode[]).map(m => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={"seg-btn" + (mode === m ? " is-active" : "")}
                disabled={running} onClick={() => { setMode(m); prepare(m, sw); }}>
                {m === "hardened" ? "Hardened" : "Naive"}
              </button>
            ))}
          </div>
          <p className="seg-help">{domain.modeHelp[mode]}</p>
        </div>
        <div className="field">
          <span className="field-label">
            Edge cases
            <button type="button" className="link-btn" disabled={running} onClick={() => { const v = allSwitches(domain, true); setSw(v); prepare(mode, v); }}>all</button>
            <button type="button" className="link-btn" disabled={running} onClick={() => { const v = allSwitches(domain, false); setSw(v); prepare(mode, v); }}>none</button>
          </span>
          <div className="switches">
            {domain.switches.map(s => (
              <label key={s.id} className="toggle">
                <input type="checkbox" id={`sw-${s.id}`} checked={!!sw[s.id]} disabled={running}
                  onChange={e => { const v = { ...sw, [s.id]: e.target.checked }; setSw(v); prepare(mode, v); }} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="actions">
          <button type="button" id="btn-start" className="btn btn-primary" disabled={running} onClick={start}>{running ? "Running…" : domain.runLabel}</button>
          <button type="button" className="btn btn-ghost" disabled={running} onClick={() => prepare()}>Reset</button>
          <label className="toggle">
            <input type="checkbox" id="opt-fast" checked={fast} onChange={e => { setFast(e.target.checked); run.setFast(e.target.checked); }} />
            <span>Fast playback</span>
          </label>
        </div>
      </div>

      <ConceptBoard domain={domain} S={S} selected={selected} onSelect={setSelected} />

      <div className="rig">
        <aside className="side">
          <div className="panel">
            <h3>Goals</h3>
            <ul className="rows">
              {domain.goals.map(g => {
                const [label, tone] = GOAL_PILL[S.goals[g.id]];
                return <li key={g.id} className="row"><span>{g.label}</span><span className={"pill " + tone}>{label}</span></li>;
              })}
            </ul>
          </div>
          <div className="panel">
            <h3>World state</h3>
            {domain.Scene && <domain.Scene S={S} />}
            <ul className="rows">
              {domain.devices.map(d => {
                const [text, tone] = S.devices[d.id] ?? ["—", ""];
                return <li key={d.id} className="row"><span>{d.label}</span><span className={"pill " + tone}>{text}</span></li>;
              })}
            </ul>
          </div>
          <Gauges domain={domain} S={S} />
        </aside>
        <div className="trace" ref={traceRef} aria-live="polite" aria-label="Agent trace">
          {example && (
            <p className="note" style={{ margin: 0 }}>
              Worked example: every edge case on, hardened harness, decisions answered automatically. The naive run filled the comparison below. Press {domain.runLabel} to play it yourself.
            </p>
          )}
          {ready ? (
            <article className="card">
              <div className="card-head"><span className="actor actor-harness">Harness</span><span className="round-tag">Ready</span></div>
              <p className="verdict info">
                {mode === "hardened" ? "Hardened" : "Naive"} harness, {onCount} edge case{onCount === 1 ? "" : "s"} on
                {onCount ? ": " + domain.switches.filter(s => sw[s.id]).map(s => s.label.toLowerCase()).join(", ") : ""}. Press {domain.runLabel}.
              </p>
            </article>
          ) : (
            run.cards.map(c => (
              <TraceCard key={c.id} card={c} userLabel={domain.userLabel} flash={!!selected && c.concepts.includes(selected)}
                onConcept={setSelected} onChoose={run.choose} />
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="compare-head">
          <h2>Hardened vs naive</h2>
          <p>{results.hardened && results.naive && results.hardened.switches !== results.naive.switches
            ? "Latest run of each harness. Edge-case switches differ between the two runs."
            : "Latest run of each harness."}</p>
        </div>
        <CompareTable domain={domain} results={results} />
      </div>
    </section>
  );
}

export function ConceptBoard({ domain, S, selected, onSelect }: { domain: Domain; S: Pick<RunState, "hit">; selected: ConceptId | null; onSelect(id: ConceptId): void }) {
  const c = selected ? CONCEPT_BY_ID[selected] : null;
  const st = selected ? S.hit[selected] : undefined;
  return (
    <div>
      <div className="board">
        {GROUPS.map(g => (
          <div key={g}>
            <p className="group-label">{g}</p>
            <div className="chips">
              {CONCEPTS.filter(x => x.group === g).map(x => (
                <button key={x.id} type="button" onClick={() => onSelect(x.id)}
                  className={["chip", S.hit[x.id] ?? "", selected === x.id ? "selected" : ""].filter(Boolean).join(" ")}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 12, alignItems: "baseline" }}>
        <p className="concept-detail">
          {c ? (
            <>
              <strong>{c.label}. </strong>{domain.concepts[c.id]}
              {st === "ok" ? " Handled in this run." : st === "miss" ? " Hit in this run, and the harness didn't handle it." : " Not exercised in this run."}{" "}
              <a href={href(`/concepts/${c.slug}`)}>Read the guide →</a>
            </>
          ) : "Click any concept to see what it means here and where it shows up in the trace."}
        </p>
        <p className="legend"><span>not exercised</span><span className="l-ok">handled</span><span className="l-miss">hit, but unhandled</span></p>
      </div>
    </div>
  );
}

function Gauges({ domain, S }: { domain: Domain; S: RunState }) {
  const p = S.tokens / domain.window;
  const g = domain.gauge2(S);
  return (
    <div className="panel">
      <h3>Harness gauges</h3>
      <div className="gauge">
        <div className="gauge-top"><span>Context window</span><b>{k(S.tokens)} / {k(domain.window)}</b></div>
        <div className="bar">
          <span className={p > 0.9 ? "danger" : p > 0.75 ? "warn" : ""} style={{ width: Math.min(100, p * 100) + "%" }} />
          <i style={{ left: "75%" }} title="Compaction threshold (75%)" />
        </div>
      </div>
      <div className="gauge">
        <div className="gauge-top"><span>{g.label}</span><b>{g.text}</b></div>
        <div className="bar">
          <span className={g.cls ?? ""} style={{ width: Math.max(0, Math.min(100, g.pct)) + "%" }} />
          <i style={{ left: g.marker + "%" }} title={g.markerTitle} />
        </div>
      </div>
      <dl className="stats">
        {domain.stats.map(([label, fn]) => <div key={label}><dt>{label}</dt><dd>{fn(S)}</dd></div>)}
      </dl>
    </div>
  );
}

export function CompareTable({ domain, results }: { domain: Domain; results: Results }) {
  const h = results.hardened, n = results.naive;
  if (!h && !n) return <p className="note">Run it to fill this in.</p>;
  const rows: [string, string | null, "low" | "high" | null, (v: number) => string][] = [
    [`Goals met (of ${domain.goals.length})`, "goals", "high", String],
    ["Safety incidents", "safety", "low", String],
    ["Unapproved risky actions", "unapproved", "low", String],
    ["False claims in the final answer", "falseClaims", "low", String],
    ...domain.compareRows,
    ["Rounds", "rounds", "low", String],
    ["Tokens used", "tokens", "low", k],
    ["Approvals asked", "approvals", null, String],
    ["Concepts handled / missed", null, null, String],
  ];
  return (
    <div className="compare-wrap">
      <table className="compare">
        <thead><tr><th>Metric</th><th>Hardened</th><th>Naive</th></tr></thead>
        <tbody>
          {rows.map(([label, key, better, fmt]) => (
            <tr key={label}>
              <td>{label}</td>
              {[h, n].map((res, i) => {
                const other = i === 0 ? n : h;
                if (!res) return <td key={i} className="num">—</td>;
                if (!key) return <td key={i} className="num">{res.handled} / {res.missed}</td>;
                const a = res[key], b = other?.[key];
                const cls = b !== undefined && better && a !== b ? ((better === "high" ? a > b : a < b) ? "better" : "worse") : "";
                return <td key={i} className={"num " + cls}>{fmt(a)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
