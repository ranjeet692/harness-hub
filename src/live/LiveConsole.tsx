import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ConceptId } from "../engine/concepts";
import type { Domain, Mode, RunState } from "../engine/types";
import { ConceptBoard, Meter } from "../components/Console";
import { TraceCard } from "../components/TraceCard";
import { ActorLegend, DecisionSheet, GOAL_PILL, RunBar, Section, SidePanel, describeLatest, toneOf, type RunStatus } from "../components/RunUI";
import { LoopViz } from "../components/LoopViz";
import { MODELS, anthropicClient } from "./anthropic";
import { LiveRun } from "./harness";
import type { LiveSpec } from "./types";

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
  const listRef = useRef<HTMLOListElement>(null);
  const placeholder = useMemo(() => new LiveRun(spec, { mode, faults, client: { create: () => Promise.reject(new Error("not started")) }, model }), [spec, mode, faults, model]);
  const active = run ?? placeholder;
  useSyncExternalStore(active.subscribe, active.getVersion);
  useEffect(() => () => run?.stop(), [run]);

  const st = active.state;
  const running = st.status === "running";
  useEffect(() => { const el = listRef.current; if (running && el) el.scrollTop = el.scrollHeight; });

  const sceneS = {
    ...(spec.sceneState?.(active.world) ?? {}), sw: faults, devices: st.devices, now: st.now,
    H: mode === "hardened", mode, finished: st.status === "done", live: true,
  } as unknown as RunState;

  function start() {
    if (!apiKey.trim() || running) return;
    saveKey(apiKey.trim(), remember);
    const r = new LiveRun(spec, { mode, faults, model, client: anthropicClient(apiKey.trim()) });
    setRun(r); setSelected(null);
    void r.start();
  }
  function showCard(id: number) {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-card="${id}"]`);
    if (!list || !el) return;
    list.scrollTop = el.offsetTop - 12;
    list.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const g = spec.gauge?.(active.world);
  const ctxPct = Math.min(100, (st.lastInput / active.opts.compactAt) * 100);
  const waiting = active.cards.some(c => c.awaiting);
  const status: RunStatus = waiting ? "waiting" : running ? "running" : st.status === "done" ? "finished" : st.status === "stopped" ? "stopped" : st.status === "error" ? "error" : "ready";
  const wide = domain.sceneLayout === "wide";

  return (
    <div className={"console" + (waiting ? " has-decision" : "")}>
      <Section n={1} title="Connect a model and set up the run" lead="Here a real Claude model makes every decision. The harness around it is the same code in both modes, with the safety parts switched on or off.">
        <div className="setup live-setup">
          <div className="key-card">
            <label className="field-label" htmlFor="api-key">Anthropic API key</label>
            <input id="api-key" className="input" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={apiKey}
              onChange={e => setApiKey(e.target.value)} disabled={running} />
            <label className="check">
              <input type="checkbox" id="remember-key" checked={remember} onChange={e => { setRemember(e.target.checked); saveKey(apiKey.trim(), e.target.checked); }} />
              <span>Remember on this device</span>
            </label>
            <p className="fineprint">
              Your key goes only to api.anthropic.com, straight from this browser. harness-hub has no server. A run is roughly 10–25 model calls, usually a few cents with Haiku.
            </p>
            <label className="field-label" htmlFor="model">Model</label>
            <select id="model" className="input" value={model} onChange={e => setModel(e.target.value)} disabled={running}>
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="setup-right">
            <div className="mode-cards" role="radiogroup" aria-label="Harness">
              {(["hardened", "naive"] as Mode[]).map(m => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={running}
                  className={"mode-card" + (mode === m ? " is-active" : "")} onClick={() => { setMode(m); setRun(null); }}>
                  <span className="mode-radio" aria-hidden="true" />
                  <span className="mode-name">{m === "hardened" ? "Hardened harness" : "Naive harness"}</span>
                  <span className="mode-desc">{m === "hardened"
                    ? "Tiers, validation, guards, approvals, retries, compaction and a stop hook, all enforced in code."
                    : "The same model and tools with a thin loop: every tool exposed, nothing checked."}</span>
                </button>
              ))}
            </div>
            <fieldset className="edges" disabled={running}>
              <legend><span>Things that go wrong in the world</span><span className="edges-count">{spec.faults.filter(f => faults[f.id]).length} of {spec.faults.length} on</span></legend>
              <div className="edge-grid">
                {spec.faults.map(f => (
                  <label key={f.id} className={"edge" + (faults[f.id] ? " is-on" : "")}>
                    <input type="checkbox" id={`live-${f.id}`} checked={!!faults[f.id]}
                      onChange={e => { setFaults({ ...faults, [f.id]: e.target.checked }); setRun(null); }} />
                    <span className="switch" aria-hidden="true" />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="notice">{spec.modelSide}</p>
          </div>
        </div>
      </Section>

      <RunBar
        status={status} round={st.rounds} goals={st.goals} goalLabels={domain.goals}
        latest={run ? describeLatest(active.cards, domain.userLabel) : !apiKey.trim() ? "Add an API key above to start. Create one in the Anthropic Console under API keys." : ""}
        actions={<>
          <button type="button" className="btn btn-primary" onClick={start} disabled={running || !apiKey.trim()}>{running ? "Running…" : "Run with a real model"}</button>
          {running && <button type="button" className="btn btn-secondary" onClick={() => run?.stop()}>Stop</button>}
        </>}
      />
      {st.status === "error" && <p className="errbox" role="alert">{st.error}</p>}

      <Section n={2} title="Watch the run" lead="Every model call and every harness check, as it happens. When the model wants to do something risky, the run pauses and asks you at the bottom of the screen.">
        <LoopViz cards={active.cards} hit={st.hit} rounds={st.rounds} tokens={st.lastInput} window={active.opts.compactAt}
          status={status} userLabel={domain.userLabel} modelLabel="Claude" approvals={st.approvals} />
        {wide && domain.Scene && <div className="world-wide"><domain.Scene S={sceneS} /></div>}
        <div className="watch">
          <div className="timeline-wrap">
            <ActorLegend userLabel={domain.userLabel} />
            <ol className="timeline" ref={listRef} aria-label="Live run timeline">
              {!run && (
                <li className="step actor-harness v-info">
                  <span className="step-mark" aria-hidden="true">H</span>
                  <article className="step-body">
                    <header className="step-meta"><span className="step-actor">Harness</span><span className="step-title">Ready</span></header>
                    <p className="step-verdict info">{mode === "hardened" ? "Hardened" : "Naive"} harness around {MODELS.find(m => m.id === model)?.label}. {spec.readyText}</p>
                  </article>
                </li>
              )}
              {active.cards.map(c => (
                <TraceCard key={c.id} card={c} userLabel={domain.userLabel} flash={!!selected && c.concepts.includes(selected)} onConcept={setSelected} onChoose={active.choose} />
              ))}
            </ol>
          </div>
          <aside className="watch-side" aria-label="State of the world">
            <SidePanel title="Goals" hint={st.status === "done" ? "Verified against the simulated world." : "Checked against the simulated world when the run ends."}>
              <ul className="kv">
                {domain.goals.map(gl => {
                  const [label, tone] = GOAL_PILL[st.goals[gl.id] ?? "pending"];
                  return <li key={gl.id}><span>{gl.label}</span><span className={"chip " + tone}>{label}</span></li>;
                })}
              </ul>
            </SidePanel>
            <SidePanel title="World" hint="Simulated, and changed only by the model's tool calls.">
              {!wide && domain.Scene && <domain.Scene S={sceneS} />}
              <ul className="kv">
                {domain.devices.map(d => {
                  const [text, tone] = st.devices[d.id] ?? ["—", ""];
                  return <li key={d.id}><span>{d.label}</span><span className={"chip " + toneOf(tone)}>{text}</span></li>;
                })}
              </ul>
            </SidePanel>
            <SidePanel title="Limits" hint={`Compacts (or, if naive, truncates) past ${active.opts.compactAt.toLocaleString()} input tokens.`}>
              <Meter label="Last request" value={`${st.lastInput.toLocaleString()} tok`} pct={ctxPct} marker={100} cls={ctxPct >= 100 ? "warn" : ""} />
              {g && <Meter label={g.label} value={g.text} pct={g.pct} marker={g.marker} cls={g.cls === "danger" ? "bad" : g.cls ?? ""} />}
              <dl className="stats">
                <div><dt>Model rounds</dt><dd>{st.rounds}</dd></div>
                <div><dt>Retries</dt><dd>{st.retries}</dd></div>
                <div><dt>Tokens in</dt><dd>{st.inputTotal.toLocaleString()}</dd></div>
                <div><dt>Tokens out</dt><dd>{st.outputTotal.toLocaleString()}</dd></div>
              </dl>
            </SidePanel>
          </aside>
        </div>
      </Section>

      <Section n={3} title="What the harness handled" lead="Green when the harness dealt with a concept, red when it came up and nothing stopped it. Select one for details.">
        <ConceptBoard domain={domain} S={st} selected={selected} onSelect={setSelected} />
      </Section>

      <DecisionSheet cards={active.cards} onChoose={active.choose} onShow={showCard} />
    </div>
  );
}
