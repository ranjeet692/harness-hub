import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ConceptId } from "../engine/concepts";
import type { Domain, GoalStatus, Mode, RunState } from "../engine/types";
import { ConceptBoard } from "../components/Console";
import { TraceCard } from "../components/TraceCard";
import { MODELS, anthropicClient } from "./anthropic";
import { LiveRun } from "./harness";
import type { LiveSpec } from "./types";

const GOAL_PILL: Record<GoalStatus, [string, string]> = {
  pending: ["Pending", ""], active: ["Working", "info"], done: ["Done", "good"], fallback: ["Via fallback", "warn"],
  partial: ["Partial", "warn"], failed: ["Failed", "danger"], declined: ["Declined", "info"], skipped: ["Not reached", "danger"],
};
const KEY_STORE = "harness-hub.anthropic-key";

function readKey(): { key: string; remember: boolean } {
  try {
    const local = localStorage.getItem(KEY_STORE);
    if (local) return { key: local, remember: true };
    return { key: sessionStorage.getItem(KEY_STORE) ?? "", remember: false };
  } catch { return { key: "", remember: false }; }
}
function saveKey(key: string, remember: boolean) {
  try {
    localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE);
    if (key) (remember ? localStorage : sessionStorage).setItem(KEY_STORE, key);
  } catch { /* storage unavailable: the key lives in memory only */ }
}

/** A real Claude model makes the decisions; the harness around it is enforced in code. */
export function LiveConsole({ domain, spec }: { domain: Domain; spec: LiveSpec }) {
  const initial = useMemo(readKey, []);
  const [apiKey, setApiKey] = useState(initial.key);
  const [remember, setRemember] = useState(initial.remember);
  const [model, setModel] = useState(MODELS[0].id);
  const [mode, setMode] = useState<Mode>("hardened");
  const [faults, setFaults] = useState<Record<string, boolean>>(() => Object.fromEntries(spec.faults.map(f => [f.id, true])));
  const [run, setRun] = useState<LiveRun | null>(null);
  const [selected, setSelected] = useState<ConceptId | null>(null);
  const placeholder = useMemo(() => new LiveRun(spec, { mode, faults, client: { create: () => Promise.reject(new Error("not started")) }, model }), [spec, mode, faults, model]);
  const active = run ?? placeholder;
  useSyncExternalStore(active.subscribe, active.getVersion);
  useEffect(() => () => run?.stop(), [run]);

  const running = run?.state.status === "running";
  const st = active.state;
  const sceneS = { ...(spec.sceneState?.(active.world) ?? {}), sw: faults } as unknown as RunState;

  function start() {
    if (!apiKey.trim() || running) return;
    saveKey(apiKey.trim(), remember);
    const r = new LiveRun(spec, { mode, faults, model, client: anthropicClient(apiKey.trim()) });
    setRun(r); setSelected(null);
    void r.start();
  }

  const g = spec.gauge?.(active.world);
  const ctxPct = Math.min(100, (st.lastInput / active.opts.compactAt) * 100);

  return (
    <section className="console" aria-label={`${domain.shortTitle} live model console`}>
      <div className="live-setup">
        <div className="field">
          <label className="field-label" htmlFor="api-key">Anthropic API key</label>
          <input id="api-key" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={apiKey}
            onChange={e => setApiKey(e.target.value)} disabled={running} />
          <label className="toggle">
            <input type="checkbox" id="remember-key" checked={remember} onChange={e => { setRemember(e.target.checked); saveKey(apiKey.trim(), e.target.checked); }} />
            <span>Remember on this device</span>
          </label>
          <p className="hint">
            Your key goes only to api.anthropic.com, straight from this browser. harness-hub has no server. Without “remember”, it's kept until you close the tab.
            A run is roughly 10–25 model calls; with Haiku that usually costs a few cents.
          </p>
          <label className="field-label" htmlFor="model">Model</label>
          <select id="model" value={model} onChange={e => setModel(e.target.value)} disabled={running}>
            {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="field-label">Harness</span>
          <div className="segmented" role="radiogroup" aria-label="Harness mode">
            {(["hardened", "naive"] as Mode[]).map(m => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={running}
                className={"seg-btn" + (mode === m ? " is-active" : "")} onClick={() => { setMode(m); setRun(null); }}>
                {m === "hardened" ? "Hardened" : "Naive"}
              </button>
            ))}
          </div>
          <p className="seg-help">{mode === "hardened"
            ? "Tiers, validation, guards, gates, retries, compaction and a stop hook, all enforced in code."
            : "The same model and tools with a thin loop: every tool exposed, nothing checked."}</p>
          <span className="field-label">World faults</span>
          <div className="switches">
            {spec.faults.map(f => (
              <label key={f.id} className="toggle">
                <input type="checkbox" id={`live-${f.id}`} checked={!!faults[f.id]} disabled={running}
                  onChange={e => { setFaults({ ...faults, [f.id]: e.target.checked }); setRun(null); }} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
          <p className="warnbox">{spec.modelSide}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={start} disabled={running || !apiKey.trim()}>{running ? "Running…" : "Run with a real model"}</button>
            {running && <button type="button" className="btn btn-ghost" onClick={() => run?.stop()}>Stop</button>}
          </div>
          {!apiKey.trim() && <p className="hint">Add an API key to start. Create one in the Anthropic Console under API keys.</p>}
          {st.status === "error" && <p className="errbox">{st.error}</p>}
        </div>
      </div>

      <ConceptBoard domain={domain} S={st} selected={selected} onSelect={setSelected} />

      <div className="rig">
        <aside className="side">
          <div className="panel">
            <h3>Goals {st.status === "done" ? "(verified)" : "(checked at the end)"}</h3>
            <ul className="rows">
              {domain.goals.map(g => {
                const [label, tone] = GOAL_PILL[st.goals[g.id] ?? "pending"];
                return <li key={g.id} className="row"><span>{g.label}</span><span className={"pill " + tone}>{label}</span></li>;
              })}
            </ul>
          </div>
          <div className="panel">
            <h3>World state (simulated)</h3>
            {domain.Scene && <domain.Scene S={sceneS} />}
            <ul className="rows">
              {domain.devices.map(d => {
                const [text, tone] = st.devices[d.id] ?? ["—", ""];
                return <li key={d.id} className="row"><span>{d.label}</span><span className={"pill " + tone}>{text}</span></li>;
              })}
            </ul>
          </div>
          <div className="panel">
            <h3>Harness gauges</h3>
            <div className="gauge">
              <div className="gauge-top"><span>Last request</span><b>{st.lastInput.toLocaleString()} tok</b></div>
              <div className="bar"><span className={ctxPct >= 100 ? "warn" : ""} style={{ width: ctxPct + "%" }} /><i style={{ left: "100%" }} title="Compaction threshold" /></div>
              <p className="hint">Compacts (or truncates, if naive) past {active.opts.compactAt.toLocaleString()} input tokens.</p>
            </div>
            {g && (
              <div className="gauge">
                <div className="gauge-top"><span>{g.label}</span><b>{g.text}</b></div>
                <div className="bar"><span className={g.cls ?? ""} style={{ width: g.pct + "%" }} /><i style={{ left: g.marker + "%" }} /></div>
              </div>
            )}
            <dl className="stats">
              <div><dt>Model rounds</dt><dd>{st.rounds}</dd></div>
              <div><dt>Retries</dt><dd>{st.retries}</dd></div>
              <div><dt>Tokens in</dt><dd>{st.inputTotal.toLocaleString()}</dd></div>
              <div><dt>Tokens out</dt><dd>{st.outputTotal.toLocaleString()}</dd></div>
            </dl>
          </div>
        </aside>
        <div className="trace" aria-live="polite" aria-label="Live agent trace">
          {!run && (
            <article className="card">
              <div className="card-head"><span className="actor actor-harness">Harness</span><span className="round-tag">Ready</span></div>
              <p className="verdict info">
                {mode === "hardened" ? "Hardened" : "Naive"} harness around {MODELS.find(m => m.id === model)?.label}. {spec.readyText}
              </p>
            </article>
          )}
          {active.cards.map(c => (
            <TraceCard key={c.id} card={c} userLabel={domain.userLabel} flash={!!selected && c.concepts.includes(selected)} onConcept={setSelected} onChoose={active.choose} />
          ))}
        </div>
      </div>
    </section>
  );
}
