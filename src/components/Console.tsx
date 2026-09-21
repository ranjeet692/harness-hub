import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CONCEPTS, CONCEPT_BY_ID, GROUPS, type ConceptId } from "../engine/concepts";
import { k } from "../engine/format";
import { Run, allSwitches, runInstant } from "../engine/run";
import type { Domain, Mode, RunResult, RunState } from "../engine/types";
import { href } from "../router";
import { TraceCard } from "./TraceCard";
import { ActorLegend, DecisionSheet, GOAL_PILL, RunBar, Section, SidePanel, describeLatest, toneOf, type RunStatus } from "./RunUI";

type Results = Partial<Record<Mode, RunResult>>;

/** The scripted harness console: set up, watch, see what was handled, compare. */
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
  const listRef = useRef<HTMLOListElement>(null);
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

  // Keep the newest step in view while a run plays.
  useEffect(() => {
    const el = listRef.current;
    if (running && el) el.scrollTop = el.scrollHeight;
  });

  // Jump to the first step tagged with the selected concept.
  useEffect(() => {
    if (!selected || !listRef.current) return;
    const card = run.cards.find(c => c.concepts.includes(selected));
    if (card) showCard(card.id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, run]);

  function showCard(id: number, scrollPage = true) {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-card="${id}"]`);
    if (!list || !el) return;
    list.scrollTop = el.offsetTop - 12;
    if (scrollPage) list.scrollIntoView({ block: "center", behavior: "smooth" });
  }

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
  const waiting = run.cards.some(c => c.awaiting);
  const status: RunStatus = waiting ? "waiting" : running ? "running" : example ? "example" : ready ? "ready" : run.done ? "finished" : "ready";
  const latest = ready ? "" : example
    ? "A finished example with every edge case on and decisions answered for you. Press Run to watch one step by step."
    : describeLatest(run.cards, domain.userLabel);
  const wide = domain.sceneLayout === "wide";

  return (
    <div className={"console" + (waiting ? " has-decision" : "")}>
      <Section n={1} title="Set up the run" lead="Choose the harness, then choose what goes wrong. The model's choices are scripted, so the only difference between runs is the harness around it.">
        <div className="setup">
          <div className="mode-cards" role="radiogroup" aria-label="Harness">
            {(["hardened", "naive"] as Mode[]).map(m => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={running}
                className={"mode-card" + (mode === m ? " is-active" : "")} onClick={() => { setMode(m); prepare(m, sw); }}>
                <span className="mode-radio" aria-hidden="true" />
                <span className="mode-name">{m === "hardened" ? "Hardened harness" : "Naive harness"}</span>
                <span className="mode-desc">{domain.modeHelp[m]}</span>
              </button>
            ))}
          </div>
          <fieldset className="edges" disabled={running}>
            <legend>
              <span>Edge cases</span>
              <span className="edges-count">{onCount} of {domain.switches.length} on</span>
              <button type="button" className="link" onClick={() => { const v = allSwitches(domain, true); setSw(v); prepare(mode, v); }}>All</button>
              <button type="button" className="link" onClick={() => { const v = allSwitches(domain, false); setSw(v); prepare(mode, v); }}>None</button>
            </legend>
            <div className="edge-grid">
              {domain.switches.map(s => (
                <label key={s.id} className={"edge" + (sw[s.id] ? " is-on" : "")}>
                  <input type="checkbox" id={`sw-${s.id}`} checked={!!sw[s.id]}
                    onChange={e => { const v = { ...sw, [s.id]: e.target.checked }; setSw(v); prepare(mode, v); }} />
                  <span className="switch" aria-hidden="true" />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Section>

      <RunBar
        status={status} round={ready || example ? 0 : S.rounds} latest={latest} goals={S.goals} goalLabels={domain.goals}
        actions={<>
          <button type="button" id="btn-start" className="btn btn-primary" disabled={running} onClick={start}>{running ? "Running…" : domain.runLabel}</button>
          <button type="button" className="btn btn-secondary" disabled={running} onClick={() => prepare()}>Reset</button>
          <label className="speed" title="Play the run four times faster">
            <input type="checkbox" id="opt-fast" checked={fast} onChange={e => { setFast(e.target.checked); run.setFast(e.target.checked); }} />
            <span>4× speed</span>
          </label>
        </>}
      />

      <Section n={2} title="Watch the run" lead="Each step appears as it happens. Model steps are the agent deciding. Harness steps are the code around it checking, blocking or retrying. When a step needs you, the run pauses and asks you at the bottom of the screen.">
        {wide && domain.Scene && <div className="world-wide"><domain.Scene S={S} /></div>}
        <div className="watch">
          <div className="timeline-wrap">
            <ActorLegend userLabel={domain.userLabel} />
            <ol className="timeline" ref={listRef} aria-label="Run timeline">
              {ready ? (
                <li className="step actor-harness v-info">
                  <span className="step-mark" aria-hidden="true">H</span>
                  <article className="step-body">
                    <header className="step-meta"><span className="step-actor">Harness</span><span className="step-title">Ready</span></header>
                    <p className="step-verdict info">
                      {mode === "hardened" ? "Hardened" : "Naive"} harness with {onCount} edge case{onCount === 1 ? "" : "s"} on. Press {domain.runLabel} to start.
                    </p>
                  </article>
                </li>
              ) : run.cards.map(c => (
                <TraceCard key={c.id} card={c} userLabel={domain.userLabel} flash={!!selected && c.concepts.includes(selected)}
                  onConcept={setSelected} onChoose={run.choose} />
              ))}
            </ol>
          </div>
          <aside className="watch-side" aria-label="State of the world">
            <SidePanel title="Goals" hint="Checked against the real state, not the agent's word.">
              <ul className="kv">
                {domain.goals.map(g => {
                  const [label, tone] = GOAL_PILL[S.goals[g.id]];
                  return <li key={g.id}><span>{g.label}</span><span className={"chip " + tone}>{label}</span></li>;
                })}
              </ul>
            </SidePanel>
            <SidePanel title="World" hint="What the tools have actually changed.">
              {!wide && domain.Scene && <domain.Scene S={S} />}
              <ul className="kv">
                {domain.devices.map(d => {
                  const [text, tone] = S.devices[d.id] ?? ["—", ""];
                  return <li key={d.id}><span>{d.label}</span><span className={"chip " + toneOf(tone)}>{text}</span></li>;
                })}
              </ul>
            </SidePanel>
            <Gauges domain={domain} S={S} />
          </aside>
        </div>
      </Section>

      <Section n={3} title="What the harness handled" lead="Twenty harness concepts. Each one lights up when the run touches it: green if the harness dealt with it, red if it came up and nothing stopped the damage. Select one to see where it happened.">
        <ConceptBoard domain={domain} S={S} selected={selected} onSelect={setSelected} />
      </Section>

      <Section n={4} title="Hardened vs naive" lead="The latest run of each harness, side by side. Run both with the same edge cases for a fair comparison.">
        <CompareTable domain={domain} results={results} />
        {results.hardened && results.naive && results.hardened.switches !== results.naive.switches && (
          <p className="fineprint">The two runs used different edge cases.</p>
        )}
      </Section>

      <DecisionSheet cards={run.cards} onChoose={run.choose} onShow={id => showCard(id)} />
    </div>
  );
}

export function ConceptBoard({ domain, S, selected, onSelect }: { domain: Domain; S: Pick<RunState, "hit">; selected: ConceptId | null; onSelect(id: ConceptId): void }) {
  const c = selected ? CONCEPT_BY_ID[selected] : null;
  const st = selected ? S.hit[selected] : undefined;
  const handled = Object.values(S.hit).filter(v => v === "ok").length;
  const missed = Object.values(S.hit).filter(v => v === "miss").length;
  return (
    <div className="board-wrap">
      <div className="board-summary">
        <span><b className="good">{handled}</b> handled</span>
        <span><b className="bad">{missed}</b> came up and weren't handled</span>
        <span><b>{CONCEPTS.length - handled - missed}</b> didn't come up</span>
      </div>
      <div className="board">
        {GROUPS.map(g => (
          <div key={g} className="board-col">
            <h3>{g}</h3>
            <ul>
              {CONCEPTS.filter(x => x.group === g).map(x => {
                const h = S.hit[x.id];
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => onSelect(x.id)} aria-pressed={selected === x.id}
                      className={["concept", h ?? "none", selected === x.id ? "selected" : ""].join(" ")}>
                      <span className="ci" aria-hidden="true">{h === "ok" ? "✓" : h === "miss" ? "✕" : ""}</span>
                      {x.label}
                      <span className="sr-only">{h === "ok" ? " (handled)" : h === "miss" ? " (not handled)" : " (didn't come up)"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className={"concept-detail" + (c ? " has" : "")} aria-live="polite">
        {c ? (
          <>
            <p className="cd-title">{c.label} <span className={"chip " + (st === "ok" ? "good" : st === "miss" ? "bad" : "")}>{st === "ok" ? "Handled in this run" : st === "miss" ? "Not handled in this run" : "Didn't come up in this run"}</span></p>
            <p>{domain.concepts[c.id]}</p>
            <a href={href(`/concepts/${c.slug}`)}>Read the {c.label.toLowerCase()} guide →</a>
          </>
        ) : <p>Select a concept to see what it means in this scenario and jump to where it happened.</p>}
      </div>
    </div>
  );
}

function Gauges({ domain, S }: { domain: Domain; S: RunState }) {
  const p = S.tokens / domain.window;
  const g = domain.gauge2(S);
  return (
    <SidePanel title="Limits" hint="Budgets the harness watches on every round.">
      <Meter label="Context window" value={`${k(S.tokens)} / ${k(domain.window)}`} pct={p * 100} marker={75} markerTitle="Compaction at 75%" cls={p > 0.9 ? "bad" : p > 0.75 ? "warn" : ""} />
      <Meter label={g.label} value={g.text} pct={g.pct} marker={g.marker} markerTitle={g.markerTitle} cls={g.cls === "danger" ? "bad" : g.cls ?? ""} />
      <dl className="stats">
        {domain.stats.map(([label, fn]) => <div key={label}><dt>{label}</dt><dd>{fn(S)}</dd></div>)}
      </dl>
    </SidePanel>
  );
}

export function Meter({ label, value, pct, marker, markerTitle, cls }: { label: string; value: string; pct: number; marker?: number; markerTitle?: string; cls?: string }) {
  return (
    <div className="meter">
      <div className="meter-top"><span>{label}</span><b>{value}</b></div>
      <div className="meter-bar">
        <span className={cls ?? ""} style={{ width: Math.max(0, Math.min(100, pct)) + "%" }} />
        {marker !== undefined && <i style={{ left: marker + "%" }} title={markerTitle} />}
      </div>
    </div>
  );
}

export function CompareTable({ domain, results }: { domain: Domain; results: Results }) {
  const h = results.hardened, n = results.naive;
  if (!h && !n) return <p className="fineprint">Run it to fill this in.</p>;
  const rows: [string, string | null, "low" | "high" | null, (v: number) => string][] = [
    [`Goals met (of ${domain.goals.length})`, "goals", "high", String],
    ["Safety incidents", "safety", "low", String],
    ["Risky actions without approval", "unapproved", "low", String],
    ["False claims in the final answer", "falseClaims", "low", String],
    ...domain.compareRows,
    ["Model rounds", "rounds", "low", String],
    ["Tokens used", "tokens", "low", k],
    ["Approvals asked", "approvals", null, String],
    ["Concepts handled / missed", null, null, String],
  ];
  return (
    <div className="compare-wrap">
      <table className="compare">
        <thead><tr><th scope="col">Metric</th><th scope="col">Hardened</th><th scope="col">Naive</th></tr></thead>
        <tbody>
          {rows.map(([label, key, better, fmt]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
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
