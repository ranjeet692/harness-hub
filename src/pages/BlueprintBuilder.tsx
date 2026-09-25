import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { CONCEPT_BY_ID, type ConceptId } from "../engine/concepts";
import { href } from "../router";
import { exampleDesign } from "../blueprint/example";
import { clientSummary, designDoc, evalCsv, skeleton } from "../blueprint/exports";
import {
  CONCEPT_IDS, CONCEPT_LABEL, CONCEPT_STEP, QUESTION, RISKS, STEPS, analyze, groupFindings, coverage, emptyDesign, suggestTrace, surfaced, verdict,
  type Autonomy, type Design, type Finding, type Shape, type Status, type StepId, type Tier,
} from "../blueprint/model";

const KEY = "harness-hub.blueprint.v1";

function load(): Design | null {
  try { const raw = localStorage.getItem(KEY); if (!raw) return null; const d = JSON.parse(raw); return d?.v === 1 ? { ...emptyDesign(), ...d } : null; } catch { return null; }
}
function save(d: Design) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode: keep it in memory */ } }

function download(name: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The requirement with the phrases that imply harness work marked, numbered in reading order. */
export function Highlighted({ text, findings }: { text: string; findings: Finding[] }) {
  const out: ReactNode[] = [];
  const num = new Map(groupFindings(findings).map((g, i) => [g.rule.id, i + 1]));
  let at = 0;
  findings.forEach((f, i) => {
    if (f.start > at) out.push(<Fragment key={"t" + i}>{text.slice(at, f.start)}</Fragment>);
    out.push(<mark key={"m" + i} className={f.rule.concept === "workflow" ? "is-flow" : ""} title={f.rule.label}>{text.slice(f.start, f.end)}<sup>{num.get(f.rule.id)}</sup></mark>);
    at = f.end;
  });
  out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return <p className="bp-req">{out}</p>;
}

export function Ring({ design, found, size = 168 }: { design: Design; found: ConceptId[]; size?: number }) {
  const c = 2 * Math.PI * 72, seg = c / 20;
  return (
    <svg className="bp-ring" width={size} height={size} viewBox="0 0 180 180" aria-hidden="true">
      {CONCEPT_IDS.map((id, i) => {
        const s = design.concepts[id].status;
        const cls = s === "decided" ? "decided" : s === "na" ? "na" : found.includes(id) ? "found" : "open";
        return <circle key={id} className={cls} cx="90" cy="90" r="72" fill="none" strokeWidth="14" strokeDasharray={`${seg - 3} ${c - seg + 3}`} transform={`rotate(${i * 18 - 90 + 0.8} 90 90)`}><title>{CONCEPT_LABEL[id]}</title></circle>;
      })}
    </svg>
  );
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange(v: T): void; label: string }) {
  return (
    <div className="bp-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} className={"is-" + v + (v === value ? " on" : "")} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function BlueprintBuilder({ step: stepParam }: { step?: string }) {
  const [d, setD] = useState<Design>(() => load() ?? emptyDesign());
  const [editing, setEditing] = useState(() => !d.requirement.trim());
  const stepIdx = Math.max(0, STEPS.findIndex(s => s.id === stepParam));
  const step = STEPS[stepIdx];
  useEffect(() => save(d), [d]);

  const findings = useMemo(() => analyze(d.requirement), [d.requirement]);
  const found = useMemo(() => surfaced(findings), [findings]);
  const groups = useMemo(() => groupFindings(findings), [findings]);
  const cov = coverage(d, found);
  const set = (patch: Partial<Design>) => setD(prev => ({ ...prev, ...patch }));
  const go = (id: StepId) => { window.location.hash = href(`/blueprint/build/${id}`).slice(1); };

  /** Carry what the requirement surfaced into the design, without overwriting anything you wrote. */
  function applyFindings(prev: Design): Design {
    const concepts = { ...prev.concepts };
    for (const f of findings) {
      if (f.rule.concept === "workflow") continue;
      const c = concepts[f.rule.concept];
      if (!c.note.trim()) concepts[f.rule.concept] = { ...c, note: f.rule.then };
    }
    const v = verdict(prev.requirement);
    return { ...prev, concepts, trace: prev.trace.length ? prev.trace : suggestTrace(findings), shape: prev.job ? prev.shape : v.shape };
  }
  function next() {
    if (step.id === "requirement") setD(applyFindings);
    const n = STEPS[stepIdx + 1];
    if (n) go(n.id);
  }
  function loadExample() { setD(exampleDesign()); setEditing(false); }
  function reset() { if (window.confirm("Start a new blueprint? This clears the one saved in this browser.")) { setD(emptyDesign()); setEditing(true); go("requirement"); } }

  const conceptCards = (ids: ConceptId[]) => (
    <div className="bp-concepts">
      {ids.map(id => {
        const c = d.concepts[id];
        const hint = findings.find(f => f.rule.concept === id);
        return (
          <section key={id} id={"c-" + id} className={"bp-concept is-" + c.status + (found.includes(id) && c.status === "open" ? " is-found" : "")}>
            <header>
              <div><b>{CONCEPT_LABEL[id]}</b><a href={href(`/concepts/${CONCEPT_BY_ID[id].slug}`)}>guide</a></div>
              <Seg<Status> label={CONCEPT_LABEL[id]} value={c.status} onChange={s => set({ concepts: { ...d.concepts, [id]: { ...c, status: s } } })}
                options={[["decided", "Decided"], ["na", "Not needed"], ["open", "Open"]]} />
            </header>
            <p className="bp-q">{QUESTION[id]}</p>
            {hint && <p className="bp-hint">From the requirement: <mark>{hint.text}</mark></p>}
            <label className="sr-only" htmlFor={"n-" + id}>{CONCEPT_LABEL[id]} decision</label>
            <textarea id={"n-" + id} className="input" rows={2} value={c.note} placeholder={c.status === "na" ? "Why it isn't needed" : "Your decision, in a sentence or two"}
              onChange={e => set({ concepts: { ...d.concepts, [id]: { ...c, note: e.target.value } } })} />
          </section>
        );
      })}
    </div>
  );

  const stepConcepts = (sid: StepId) => CONCEPT_IDS.filter(id => CONCEPT_STEP[id] === sid);
  const v = verdict(d.requirement);

  let body: ReactNode;
  switch (step.id) {
    case "requirement":
      body = (
        <div className="bp-two">
          <div className="bp-card">
            <div className="bp-card-head">
              <span className="eyebrow">Requirement · as the client wrote it</span>
              <div className="bp-inline">
                <span className="mono dim">{findings.length} phrases · {groups.length} kinds</span>
                <button type="button" className="link" onClick={() => setEditing(e => !e)}>{editing ? "Show highlights" : "Edit text"}</button>
              </div>
            </div>
            {editing || !d.requirement.trim()
              ? <>
                  <label className="sr-only" htmlFor="req">Requirement</label>
                  <textarea id="req" className="input bp-req-input" rows={9} value={d.requirement} autoFocus
                    placeholder="Paste the requirement: an email from the client, a ticket, a paragraph from a proposal. Write it the way they said it."
                    onChange={e => set({ requirement: e.target.value })} />
                  {!d.requirement.trim() && <p className="fineprint">No requirement handy? <button type="button" className="link" onClick={loadExample}>Load the worked example</button>, an invoice agent for a finance team.</p>}
                </>
              : <Highlighted text={d.requirement} findings={findings} />}
            <div className="bp-verdict">
              <div className="bp-card-head"><span className="eyebrow">Agent or workflow?</span><span className="chip warn">{v.title}</span></div>
              <p>{v.why}</p>
            </div>
          </div>
          <div className="bp-card bp-list">
            <div className="bp-card-head"><span className="eyebrow">What each phrase implies</span><span className="eyebrow">concept</span></div>
            {findings.length === 0 && <p className="bp-empty">Phrases like “under ₹5 lakh”, “approved by”, “never”, “by email” and “twice” will appear here with what they mean for the harness.</p>}
            {groups.map((g, i) => (
              <div key={g.rule.id} className="bp-find">
                <span className="mono accent">{i + 1}</span>
                <div><b>{g.texts.map(t => `“${t}”`).join(", ")}</b><span>{g.rule.then}</span></div>
                <span className={"chip " + (g.rule.concept === "workflow" ? "" : "o")}>{g.rule.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
      break;
    case "job":
      body = (
        <div className="bp-two">
          <div className="bp-card bp-form">
            <label className="field-label" htmlFor="job">The job, in one sentence</label>
            <textarea id="job" className="input" rows={3} value={d.job} placeholder="By 6 pm, every invoice received today is paid, waiting for approval, or flagged with a reason."
              onChange={e => set({ job: e.target.value })} />
            <p className="fineprint">Write it so someone could check it. “Handles invoices” can't be checked; “every invoice has exactly one status by 6 pm” can.</p>
            <span className="field-label">Done means… (each line is checked in code)</span>
            {d.done.map((line, i) => (
              <div key={i} className="bp-row">
                <label className="sr-only" htmlFor={"done-" + i}>Done condition {i + 1}</label>
                <input id={"done-" + i} className="input" value={line} placeholder="No invoice is paid twice"
                  onChange={e => set({ done: d.done.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="icon-btn" aria-label={`Remove condition ${i + 1}`} onClick={() => set({ done: d.done.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button type="button" className="link" onClick={() => set({ done: [...d.done, ""] })}>+ Add a condition</button>
          </div>
          <div className="bp-card bp-form">
            <span className="field-label">Shape</span>
            <div className="bp-shapes" role="radiogroup" aria-label="Shape">
              {([["workflow", "Workflow", "Fixed steps. A model for one step at most."], ["workflow+agent", "Workflow + agent step", "Fixed steps, with a loop only where judgment is needed."], ["agent", "Agent loop", "The model picks the next step every round."], ["multi", "Orchestrator + subagents", "Work fans out to agents with their own context."]] as [Shape, string, string][]).map(([s, t, x]) => (
                <button key={s} type="button" role="radio" aria-checked={d.shape === s} className={"bp-shape" + (d.shape === s ? " on" : "")} onClick={() => set({ shape: s })}>
                  <b>{t}</b><span>{x}</span>{v.shape === s && d.requirement.trim() && <em>suggested</em>}
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="rounds">Most rounds per task</label>
            <input id="rounds" className="input bp-num" type="number" min={1} max={200} value={d.maxRounds} onChange={e => set({ maxRounds: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
        </div>
      );
      break;
    case "world":
      body = (
        <div className="bp-stack">
          <div className="bp-card bp-table-card">
            <div className="bp-card-head"><span className="eyebrow">Systems it touches</span><span className="fineprint">Mark the source of truth for each fact. When copies disagree, it wins.</span></div>
            <div className="bp-scroll">
              <table className="bp-table">
                <thead><tr><th scope="col">System</th><th scope="col">Access</th><th scope="col">Truth</th><th scope="col">Money</th><th scope="col">Untrusted text</th><th scope="col">Notes</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
                <tbody>
                  {d.world.map((s, i) => {
                    const up = (p: Partial<typeof s>) => set({ world: d.world.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                    return (
                      <tr key={i}>
                        <td><input className="input" aria-label="System name" value={s.name} onChange={e => up({ name: e.target.value })} /></td>
                        <td><select className="input" aria-label="Access" value={s.access} onChange={e => up({ access: e.target.value as typeof s.access })}><option value="read">read</option><option value="write">write</option><option value="read+write">read + write</option></select></td>
                        <td><input type="checkbox" aria-label="Source of truth" checked={s.truth} onChange={e => up({ truth: e.target.checked })} /></td>
                        <td><input type="checkbox" aria-label="Moves money" checked={s.money} onChange={e => up({ money: e.target.checked })} /></td>
                        <td><input type="checkbox" aria-label="Untrusted text" checked={s.untrusted} onChange={e => up({ untrusted: e.target.checked })} /></td>
                        <td><input className="input" aria-label="Notes" value={s.note} onChange={e => up({ note: e.target.value })} /></td>
                        <td><button type="button" className="icon-btn" aria-label={`Remove ${s.name || "system"}`} onClick={() => set({ world: d.world.filter((_, j) => j !== i) })}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="link" onClick={() => set({ world: [...d.world, { name: "", access: "read", truth: false, money: false, untrusted: false, note: "" }] })}>+ Add a system</button>
          </div>
          <div className="bp-card bp-list">
            <div className="bp-card-head"><span className="eyebrow">Autonomy, per action</span><span className="fineprint">Decide it one action at a time, never for the agent as a whole.</span></div>
            {d.actions.map((a, i) => {
              const up = (p: Partial<typeof a>) => set({ actions: d.actions.map((x, j) => (j === i ? { ...x, ...p } : x)) });
              return (
                <div key={i} className="bp-action">
                  <div className="bp-action-text">
                    <input className="input bare" aria-label="Action" value={a.label} placeholder="Pay a matched invoice under ₹5L" onChange={e => up({ label: e.target.value })} />
                    <input className="input bare dim" aria-label="Why" value={a.why} placeholder="Why" onChange={e => up({ why: e.target.value })} />
                  </div>
                  <Seg<Autonomy> label={a.label || "Action"} value={a.autonomy} onChange={x => up({ autonomy: x })} options={[["suggest", "Suggest"], ["approve", "Approve"], ["alone", "Alone"], ["never", "Never"]]} />
                  <button type="button" className="icon-btn" aria-label={`Remove ${a.label || "action"}`} onClick={() => set({ actions: d.actions.filter((_, j) => j !== i) })}>×</button>
                </div>
              );
            })}
            <button type="button" className="link bp-add" onClick={() => set({ actions: [...d.actions, { label: "", autonomy: "approve", why: "" }] })}>+ Add an action</button>
          </div>
        </div>
      );
      break;
    case "risks":
      body = (
        <div className="bp-risks">
          {RISKS.map(r => (
            <label key={r.id} className={"bp-risk" + (d.risks[r.id] ? " on" : "")}>
              <input type="checkbox" checked={d.risks[r.id]} onChange={e => set({ risks: { ...d.risks, [r.id]: e.target.checked } })} />
              <span className="bp-risk-body"><b>{r.label}</b><span>{r.hint}</span>
                <span className="bp-chips">{r.concepts.map(c => <span key={c} className="chip">{CONCEPT_LABEL[c]}</span>)}</span>
              </span>
            </label>
          ))}
        </div>
      );
      break;
    case "loop":
      body = conceptCards(stepConcepts("loop"));
      break;
    case "tools":
      body = (
        <div className="bp-stack">
          <div className="bp-card bp-table-card">
            <div className="bp-card-head"><span className="eyebrow">Tool inventory</span><span className="fineprint">The questions a production incident would ask: how long, what if it runs twice, how do we undo it.</span></div>
            <div className="bp-scroll">
              <table className="bp-table">
                <thead><tr><th scope="col">Tool</th><th scope="col">Does</th><th scope="col">Tier</th><th scope="col">Idempotency key</th><th scope="col">Timeout · retry</th><th scope="col">Undo</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
                <tbody>
                  {d.tools.map((t, i) => {
                    const up = (p: Partial<typeof t>) => set({ tools: d.tools.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                    return (
                      <tr key={i}>
                        <td><input className="input mono" aria-label="Tool name" value={t.name} onChange={e => up({ name: e.target.value })} /></td>
                        <td><input className="input" aria-label="What it does" value={t.does} onChange={e => up({ does: e.target.value })} /></td>
                        <td><select className={"input tier-" + t.tier} aria-label="Tier" value={t.tier} onChange={e => up({ tier: e.target.value as Tier })}><option value="safe">safe</option><option value="confirm">asks first</option><option value="never">never exposed</option></select></td>
                        <td><input className="input mono" aria-label="Idempotency key" value={t.key} onChange={e => up({ key: e.target.value })} /></td>
                        <td><input className="input mono" aria-label="Timeout and retry" value={t.retry} onChange={e => up({ retry: e.target.value })} /></td>
                        <td><input className="input" aria-label="Undo" value={t.undo} onChange={e => up({ undo: e.target.value })} /></td>
                        <td><button type="button" className="icon-btn" aria-label={`Remove ${t.name || "tool"}`} onClick={() => set({ tools: d.tools.filter((_, j) => j !== i) })}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="link" onClick={() => set({ tools: [...d.tools, { name: "", does: "", tier: "safe", key: "", retry: "", undo: "" }] })}>+ Add a tool</button>
          </div>
          {conceptCards(stepConcepts("tools"))}
        </div>
      );
      break;
    case "guards":
      body = conceptCards(stepConcepts("guards"));
      break;
    case "evals":
      body = (
        <div className="bp-stack">
          <div className="bp-card bp-table-card">
            <div className="bp-card-head">
              <span className="eyebrow">Traceability · every sentence to a test</span>
              <button type="button" className="link" onClick={() => set({ trace: suggestTrace(findings) })}>Rebuild from the requirement</button>
            </div>
            <div className="bp-scroll">
              <table className="bp-table">
                <thead><tr><th scope="col">The client said</th><th scope="col">Concept</th><th scope="col">Edge case we run</th><th scope="col">Must hold</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
                <tbody>
                  {d.trace.map((t, i) => {
                    const up = (p: Partial<typeof t>) => set({ trace: d.trace.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                    return (
                      <tr key={i}>
                        <td><input className="input" aria-label="The client said" value={t.said} onChange={e => up({ said: e.target.value })} /></td>
                        <td><select className="input" aria-label="Concept" value={t.concept} onChange={e => up({ concept: e.target.value as ConceptId })}>{CONCEPT_IDS.map(c => <option key={c} value={c}>{CONCEPT_LABEL[c]}</option>)}</select></td>
                        <td><input className="input" aria-label="Edge case" value={t.edge} onChange={e => up({ edge: e.target.value })} /></td>
                        <td><input className="input mono" aria-label="Must hold" value={t.hold} onChange={e => up({ hold: e.target.value })} /></td>
                        <td><button type="button" className="icon-btn" aria-label="Remove row" onClick={() => set({ trace: d.trace.filter((_, j) => j !== i) })}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="link" onClick={() => set({ trace: [...d.trace, { said: "", concept: "stophook", edge: "", hold: "" }] })}>+ Add a row</button>
          </div>
          {conceptCards(stepConcepts("evals"))}
        </div>
      );
      break;
    case "export": {
      const outs = [
        { t: "Client proposal", f: "Markdown", who: "For consultants", x: "The job, systems, who decides what, risks, tests and your open questions, in plain language, with a sign-off line.", file: "client-proposal.md", text: () => clientSummary(d) },
        { t: "Design doc", f: "Markdown", who: "For engineers", x: "HLD and LLD: tool table, every concept decision, and the traceability matrix.", file: "design-doc.md", text: () => designDoc(d) },
        { t: "Harness skeleton", f: "TypeScript", who: "For builders", x: "A harness-hub domain with your edge cases as switches and your done conditions as goals. Write the beats and run it here.", file: "index.ts", text: () => skeleton(d), type: "text/typescript" },
        { t: "Eval checklist", f: "CSV", who: "For QA", x: "One row per traced requirement, with the edge case and the threshold.", file: "evals.csv", text: () => evalCsv(d), type: "text/csv" },
      ];
      body = (
        <div className="bp-stack">
          {!cov.ready && (
            <div className="bp-card bp-blocked" role="status">
              <b>{cov.openIds.length} concept{cov.openIds.length === 1 ? " is" : "s are"} still open.</b>
              <span>Decide each one, or mark it not needed with a reason. The exports work anyway, but open items are marked OPEN in them.</span>
              <div className="bp-chips">{cov.openIds.map(id => <button key={id} type="button" className="chip-btn" onClick={() => go(CONCEPT_STEP[id])}>{CONCEPT_LABEL[id]}</button>)}</div>
            </div>
          )}
          <div className="bp-outs">
            {outs.map(o => (
              <div key={o.t} className="bp-card bp-out">
                <div className="bp-card-head"><b>{o.t}</b><span className="chip">{o.f}</span></div>
                <p>{o.x}</p>
                <div className="bp-card-head"><span className="mono dim">{o.who}</span>
                  <div className="bp-inline">
                    <button type="button" className="link" onClick={() => { navigator.clipboard?.writeText(o.text()).catch(() => {}); }}>Copy</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => download(o.file, o.text(), o.type)}>Download</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <details className="bp-card bp-preview">
            <summary>Preview the design doc</summary>
            <pre>{designDoc(d)}</pre>
          </details>
        </div>
      );
      break;
    }
  }

  const LEAD: Record<StepId, [string, string]> = {
    requirement: ["What did the client ask for?", "Paste it as they wrote it. Highlighted phrases imply harness work; each becomes a decision in the steps that follow."],
    job: ["What is the job, and what does done mean?", "A job you can check, the conditions checked in code before “done”, and the shape: is it even an agent?"],
    world: ["Where does the truth live?", "Every system the agent touches and which one wins when they disagree. Then autonomy, one action at a time."],
    risks: ["What could hurt someone?", "Mark what applies. Each risk brings the concepts that answer it, so nothing gets missed later."],
    loop: ["How does it think, remember and stop?", "Context, memory and the loop itself: what goes in each round, what persists, and what counts as stuck."],
    tools: ["Every tool, and what happens when it fails.", "Rows come from the world and autonomy you set. Then the tool-level decisions: tiers, validation, retries, keys, undo."],
    guards: ["What stops it, in code?", "The guards a prompt can't replace: approvals, limits, untrusted text, and the check before “done”."],
    evals: ["Every sentence, traced to a test.", "Each client phrase becomes an edge case you can switch on and a number that must hold."],
    export: ["Take it with you.", "Four outputs from one design. Nothing leaves your browser until you download it."],
  };

  return (
    <div className="page bp-builder">
      <div className="bp-bar">
        <div className="bp-bar-inner">
          <p className="crumbs"><a href={href("/blueprint")}>Blueprint</a><span aria-hidden="true">/</span></p>
          <label className="sr-only" htmlFor="bp-name">Design name</label>
          <input id="bp-name" className="input bare bp-name" value={d.name} placeholder="Name this harness" onChange={e => set({ name: e.target.value })} />
          <label className="sr-only" htmlFor="bp-client">Client</label>
          <input id="bp-client" className="input bare bp-client" value={d.client} placeholder="Client (optional)" onChange={e => set({ client: e.target.value })} />
          <span className="bp-saved">Saved in this browser</span>
          <button type="button" className="link" onClick={loadExample}>Load example</button>
          <button type="button" className="link" onClick={reset}>New</button>
        </div>
        <nav className="bp-steps" aria-label="Blueprint steps">
          {STEPS.map((s, i) => {
            const open = CONCEPT_IDS.filter(id => CONCEPT_STEP[id] === s.id && d.concepts[id].status === "open").length;
            return (
              <a key={s.id} href={href(`/blueprint/build/${s.id}`)} aria-current={i === stepIdx ? "step" : undefined} className={i < stepIdx ? "done" : ""}>
                <span className="mono">{String(i + 1).padStart(2, "0")}</span>{s.label}{open > 0 && i !== stepIdx && <i aria-label={`${open} open`}>{open}</i>}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="bp-layout">
        <div className="bp-main">
          <header className="bp-head">
            <div>
              <span className="eyebrow">Step {stepIdx + 1} of {STEPS.length} · {step.pass === "HLD" ? "High-level design" : step.pass === "LLD" ? "Low-level design" : step.pass}</span>
              <h1>{LEAD[step.id][0]}</h1>
            </div>
            <p>{LEAD[step.id][1]}</p>
          </header>
          {body}
        </div>

        <aside className="bp-side" aria-label="Design coverage">
          <div className="bp-side-block">
            <span className="eyebrow">Design coverage</span>
            <div className="bp-ring-wrap">
              <Ring design={d} found={found} />
              <div className="bp-ring-center"><b>{cov.decided + cov.na}</b><span>of 20 decided</span></div>
            </div>
            <ul className="bp-legend">
              <li><i className="decided" />Decided<b>{cov.decided}</b></li>
              <li><i className="na" />Not needed<b>{cov.na}</b></li>
              <li><i className="found" />Found in the text, open<b>{cov.surfacedOpen}</b></li>
              <li><i className="open" />Open<b>{cov.open}</b></li>
            </ul>
            <p className="fineprint">Every concept ends as decided, or not needed with a reason. The same rule a stop hook applies to an agent.</p>
          </div>
          <div className="bp-side-block bp-questions">
            <span className="eyebrow">Ask the client · {d.questions.filter(Boolean).length}</span>
            {d.questions.map((q, i) => (
              <div key={i} className="bp-row">
                <label className="sr-only" htmlFor={"q-" + i}>Question {i + 1}</label>
                <input id={"q-" + i} className="input" value={q} placeholder="Who approves when the controller is away?" onChange={e => set({ questions: d.questions.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="icon-btn" aria-label={`Remove question ${i + 1}`} onClick={() => set({ questions: d.questions.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button type="button" className="link" onClick={() => set({ questions: [...d.questions, ""] })}>+ Add a question</button>
          </div>
          <div className="bp-nav">
            {stepIdx > 0 && <a className="btn btn-secondary" href={href(`/blueprint/build/${STEPS[stepIdx - 1].id}`)}>Back</a>}
            {stepIdx < STEPS.length - 1 && <button type="button" className="btn btn-primary" onClick={next}>Next: {STEPS[stepIdx + 1].label} →</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}

