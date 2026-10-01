import { useEffect, useMemo, useState } from "react";
import { CONCEPT_BY_ID } from "../engine/concepts";
import { allSwitches, runInstant } from "../engine/run";
import type { Domain } from "../engine/types";
import { k } from "../engine/format";
import { href } from "../router";
import { BLUEPRINTS } from "../blueprint/domains";
import { cachedSuite, evalSuite, type Suite } from "../evals/suite";
import { PROD } from "../production/domains";
import { THREAT_CONCEPTS, checklist, measure, traceOf, type Span, type Status } from "../production/model";

const STATUS_LABEL: Record<Status, string> = { demo: "In this repo", spec: "Specified", gap: "To build" };
const KIND_ICON: Record<Span["kind"], string> = { agent: "◆", llm: "●", tool: "▸", guard: "■", human: "◉" };

/* Traces are prerendered too, so the page carries a real one before any script runs. */
const traceCache = new Map<string, ReturnType<typeof traceOf>>();
export async function warmTrace(d: Domain) {
  const run = await runInstant(d, "hardened", allSwitches(d));
  const t = traceOf(d, run.cards, "hardened");
  traceCache.set(d.id, t);
  return t;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function depth(spans: Span[], s: Span) { let n = 0, p = s.parentSpanId; while (p) { n++; p = spans.find(x => x.spanId === p)?.parentSpanId; } return n; }

export function ProductionTab({ domain }: { domain: Domain }) {
  const plan = PROD[domain.id], bp = BLUEPRINTS[domain.id];
  const items = useMemo(() => checklist(domain), [domain]);
  const [suite, setSuite] = useState<Suite | null>(() => cachedSuite(domain.id));
  const [trace, setTrace] = useState(() => traceCache.get(domain.id) ?? null);
  const [allSpans, setAllSpans] = useState(false);
  const [tasks, setTasks] = useState(200);
  const [price, setPrice] = useState(5);
  useEffect(() => {
    let alive = true;
    if (!suite) evalSuite(domain).then(s => alive && setSuite(s));
    if (!trace) warmTrace(domain).then(t => alive && setTrace(t));
    return () => { alive = false; };
  }, [domain, suite, trace]);

  if (!plan || !bp) return <p className="fineprint">No production plan for this harness yet.</p>;
  const areas = [...new Set(items.map(i => i.area))];
  const count = (s: Status) => items.filter(i => i.status === s).length;
  const m = suite ? measure(suite) : null;
  const sw = Object.fromEntries(domain.switches.map(s => [s.id, s.label]));
  const monthly = (tokens: number) => (tokens * tasks * 30 * price) / 1_000_000;
  const spans = trace?.spans ?? [];
  const shown = allSpans ? spans : spans.slice(0, 16);

  return (
    <div className="ev pr">
      <section className="ev-summary" aria-label="Readiness summary">
        <div className="ev-tile good"><b>{count("demo")}</b><span>of {items.length} production practices demonstrated in this repo</span></div>
        <div className="ev-tile"><b>{count("spec")}</b><span>specified here, not built: the plan is written down below</span></div>
        <div className="ev-tile bad"><b>{count("gap")}</b><span>still to build for a real deployment, stated plainly</span></div>
        <div className="ev-tile"><b>{m ? `${Math.round(m.passRate * 100)}%` : "…"}</b><span>eval scenarios safe and honest, <a href={href(`/d/${domain.id}/evals`)}>from the suite</a></span></div>
      </section>

      <section className="ev-section" aria-labelledby="pr-ready">
        <header className="ev-head">
          <div><span className="eyebrow">1 · Readiness</span><h2 id="pr-ready">What's real, what's planned, <em>what's missing</em></h2></div>
          <p>A demo that claims to be production-ready isn't. This is the checklist a platform team would run before letting this agent act on real systems, marked honestly.</p>
        </header>
        <div className="pr-areas">
          {areas.map(a => (
            <div key={a} className="bp-card pr-area">
              <h3>{a}</h3>
              <ul>
                {items.filter(i => i.area === a).map(i => (
                  <li key={i.label} className={"is-" + i.status}>
                    <span className={"pr-status is-" + i.status}>{STATUS_LABEL[i.status]}</span>
                    <div><b>{i.label}</b><span>{i.note}{i.link && <> <a href={href(i.link)}>See it</a></>}</span></div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="ev-section" aria-labelledby="pr-trace">
        <header className="ev-head">
          <div><span className="eyebrow">2 · Observability</span><h2 id="pr-trace">A trace of a <em>real</em> run</h2></div>
          <p>The hardened run with every edge case on, as spans: one per model round, the tool call under it, and each guard, subagent and approval as a child. This is what you'd ship to your tracing backend.</p>
        </header>
        <div className="bp-card pr-trace">
          <div className="pr-trace-head">
            <span className="mono">trace {trace?.traceId ?? "…"} · {spans.length} spans</span>
            <div className="bp-inline">
              <span className="pr-legend">{(Object.keys(KIND_ICON) as Span["kind"][]).map(kd => <span key={kd} className={"k-" + kd}>{KIND_ICON[kd]} {kd}</span>)}</span>
              {trace && <button type="button" className="btn btn-secondary btn-sm" onClick={() => download(`${domain.id}-trace.json`, JSON.stringify(trace, null, 2))}>Download JSON</button>}
            </div>
          </div>
          <ol className="pr-spans">
            {shown.map(s => (
              <li key={s.spanId} className={"k-" + s.kind + (s.status === "error" ? " is-error" : "")} style={{ paddingLeft: 14 + depth(spans, s) * 18 }}>
                <span className="pr-icon" aria-hidden="true">{KIND_ICON[s.kind]}</span>
                <span className="pr-name">{s.name}</span>
                <span className="pr-attr">{String(s.attributes["tool.result"] ?? s.attributes["harness.message"] ?? s.attributes["decision"] ?? s.attributes["llm.output"] ?? "")}</span>
                {s.attributes["harness.concepts"] && <span className="pr-concepts">{(s.attributes["harness.concepts"] as string[]).join(" · ")}</span>}
              </li>
            ))}
          </ol>
          {spans.length > 16 && <button type="button" className="link pr-more" onClick={() => setAllSpans(v => !v)}>{allSpans ? "Show fewer" : `Show all ${spans.length} spans`}</button>}
        </div>
      </section>

      <section className="ev-section" aria-labelledby="pr-slo">
        <header className="ev-head">
          <div><span className="eyebrow">3 · SLOs and cost</span><h2 id="pr-slo">The numbers it's <em>held to</em></h2></div>
          <p>Targets for the live service, next to what the eval suite measures today. The cost model uses real token counts per task; set your own volume and price.</p>
        </header>
        <div className="pr-slo-grid">
          <div className="bp-card">
            <table className="ev-table pr-table">
              <thead><tr><th scope="col">Service-level objective</th><th scope="col">Target</th></tr></thead>
              <tbody>{plan.slos.map(s => <tr key={s.name}><th scope="row">{s.name}</th><td className="mono">{s.target}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="bp-card pr-cost">
            <span className="eyebrow">Measured by the eval suite</span>
            {m ? (
              <dl className="pr-measured">
                <div><dt>Tokens per task</dt><dd>{k(m.tokensPerTask)} <small>naive {k(m.naiveTokensPerTask)}</small></dd></div>
                <div><dt>Most rounds in a task</dt><dd>{m.maxRounds}</dd></div>
                <div><dt>Approvals asked per task</dt><dd>{m.approvalsPerTask}</dd></div>
                <div><dt>Safety incidents, naive, across 11 scenarios</dt><dd className="bad">{m.incidentsNaive}</dd></div>
              </dl>
            ) : <p className="fineprint">Measuring…</p>}
            <div className="pr-calc">
              <label>Tasks a day<input className="input" type="number" min={1} value={tasks} onChange={e => setTasks(Math.max(1, Number(e.target.value) || 1))} /></label>
              <label>Your price per 1M tokens (USD)<input className="input" type="number" min={0} step={0.5} value={price} onChange={e => setPrice(Math.max(0, Number(e.target.value) || 0))} /></label>
            </div>
            {m && <p className="pr-cost-line">About <b>${monthly(m.tokensPerTask).toFixed(0)}</b> a month hardened, <b>${monthly(m.naiveTokensPerTask).toFixed(0)}</b> naive. {m.tokensPerTask > m.naiveTokensPerTask ? "The guards cost tokens; the naive harness pays in incidents instead." : "The hardened harness is also cheaper: loop guards and subagents cut wasted rounds."}</p>}
          </div>
        </div>
      </section>

      <section className="ev-section" aria-labelledby="pr-rollout">
        <header className="ev-head">
          <div><span className="eyebrow">4 · Rollout</span><h2 id="pr-rollout">From eval gate to <em>everyone</em></h2></div>
          <p>Each stage has to earn the next. The agent's autonomy grows only as the evidence does, and the kill switch works at every stage.</p>
        </header>
        <ol className="pr-stages">
          <li className="bp-card"><span className="mono accent">0</span><b>Offline evals</b><p>The release gate passes: every scenario and pair, zero safety incidents, zero false claims.</p><a href={href(`/d/${domain.id}/evals`)}>The gate</a></li>
          <li className="bp-card"><span className="mono accent">1</span><b>Shadow</b><p>{plan.shadow}</p></li>
          <li className="bp-card"><span className="mono accent">2</span><b>Canary</b><p>{plan.canary}</p></li>
          <li className="bp-card"><span className="mono accent">3</span><b>General availability</b><p>{plan.ga}</p></li>
        </ol>
        <div className="bp-card pr-kill"><b>Kill switch</b><p>{plan.killSwitch}</p></div>
      </section>

      <section className="ev-section" aria-labelledby="pr-threats">
        <header className="ev-head">
          <div><span className="eyebrow">5 · Threat model</span><h2 id="pr-threats">Where it can be <em>attacked or misused</em></h2></div>
          <p>Every mitigation below is backed by the ablation: the suite switches it off and shows the damage. A mitigation you can't test is a hope.</p>
        </header>
        <div className="pr-threat-top">
          <div className="bp-card"><span className="eyebrow">Untrusted input</span><p>{bp.untrusted}</p></div>
          <div className="bp-card"><span className="eyebrow">Never exposed to the model</span><code>{bp.tools.never.join(" · ")}</code></div>
          <div className="bp-card"><span className="eyebrow">Asks a person first</span><code>{bp.tools.confirm.join(" · ")}</code></div>
        </div>
        <div className="pr-threats">
          {THREAT_CONCEPTS.map(c => {
            const a = suite?.ablations.find(x => x.concept === c);
            const worse = a?.effects.filter(e => e.worse) ?? [];
            return (
              <div key={c} className="bp-card pr-threat">
                <a href={href(`/concepts/${CONCEPT_BY_ID[c].slug}`)}><b>{CONCEPT_BY_ID[c].label}</b></a>
                {!a ? <span className="fineprint">…</span> : a.breaks ? (
                  <p><span className="bad">Without it:</span> {[...a.newIncidents.slice(0, 1), ...worse.slice(0, 2).map(e => `${e.label.toLowerCase()} ${e.before} → ${e.after}`)].join("; ")}.</p>
                ) : <p className="dim">{a.hit === "miss" ? "Caught by another layer in this scenario; still flagged by the concept board." : "Not exercised by this scenario."}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="ev-section" aria-labelledby="pr-runbooks">
        <header className="ev-head">
          <div><span className="eyebrow">6 · Runbooks</span><h2 id="pr-runbooks">When it goes wrong <em>anyway</em></h2></div>
          <p>The incidents this agent is most likely to cause, how to spot them, stop them and fix them. Each names the eval that reproduces it, so the fix ships with a regression test.</p>
        </header>
        <div className="pr-runbooks">
          {plan.runbooks.map(r => (
            <article key={r.incident} className="bp-card pr-runbook">
              <h3>{r.incident}</h3>
              <dl>
                <div><dt>Detect</dt><dd>{r.detect}</dd></div>
                <div><dt>Contain</dt><dd>{r.contain}</dd></div>
                <div><dt>Recover</dt><dd>{r.recover}</dd></div>
                <div><dt>Regression</dt><dd><a href={href(`/d/${domain.id}/evals`)}>{sw[r.repro.sw]}</a>, without {CONCEPT_BY_ID[r.repro.off].label.toLowerCase()}. Reproduced in <code>tests/production.test.ts</code>.</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
