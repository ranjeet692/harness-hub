import { useEffect, useState } from "react";
import { CONCEPT_BY_ID } from "../engine/concepts";
import type { Domain, GoalStatus } from "../engine/types";
import { href } from "../router";
import { cachedSuite, evalSuite, passes, type Outcome, type Suite } from "../evals/suite";

const MARK: Record<GoalStatus, [string, string]> = {
  done: ["✓", "good"], fallback: ["✓", "good"], partial: ["½", "warn"], failed: ["✕", "bad"],
  declined: ["–", "info"], skipped: ["✕", "bad"], pending: ["·", ""], active: ["·", ""],
};

function why(o: Outcome, G: number) {
  const r = o.result;
  if (r.safety) return o.incidents[0] ?? `${r.safety} safety incident${r.safety > 1 ? "s" : ""}`;
  if (r.unapproved) return `${r.unapproved} risky action${r.unapproved > 1 ? "s" : ""} without approval`;
  if (r.falseClaims) return `${r.falseClaims} false claim${r.falseClaims > 1 ? "s" : ""} in the final answer`;
  if (r.goals < G) return `${r.goals} of ${G} goals met`;
  return "";
}

function Goals({ domain, o }: { domain: Domain; o: Outcome }) {
  return (
    <span className="ev-goals" aria-label={domain.goals.map(g => `${g.label}: ${o.goals[g.id]}`).join(", ")}>
      {domain.goals.map(g => { const [m, t] = MARK[o.goals[g.id]] ?? ["·", ""]; return <i key={g.id} className={t} title={`${g.label}: ${o.goals[g.id]}`}>{m}</i>; })}
    </span>
  );
}

/** The eval suite for one harness: scenario matrix, pairwise stress, ablation and the release gate. */
export function EvalsTab({ domain }: { domain: Domain }) {
  const [suite, setSuite] = useState<Suite | null>(() => cachedSuite(domain.id));
  const [ms, setMs] = useState<number | null>(null);
  const [rerun, setRerun] = useState(0);
  useEffect(() => {
    let alive = true;
    const t = performance.now();
    evalSuite(domain).then(s => { if (alive) { setSuite(s); setMs(Math.max(1, Math.round(performance.now() - t))); } });
    return () => { alive = false; };
  }, [domain, rerun]);

  if (!suite) return <p className="fineprint">Running the eval suite…</p>;
  const G = domain.goals.length;
  const S = suite.scenarios;
  const hPass = S.filter(s => passes(s.hardened, G)).length, nPass = S.filter(s => passes(s.naive, G)).length;
  const breaks = suite.ablations.filter(a => a.breaks);
  const silent = suite.ablations.filter(a => !a.breaks && a.hit === "miss");
  const structural = suite.ablations.filter(a => !a.breaks && a.hit !== "miss");
  const maxLost = Math.max(1, ...breaks.map(a => a.goalsLost));
  const gatePass = suite.gate.every(g => g.pass);

  return (
    <div className="ev">
      <section className="ev-summary" aria-label="Summary">
        <div className="ev-tile">
          <b>{suite.runs}</b><span>runs of the real engine{ms ? `, ${ms} ms in your browser` : ""}</span>
          <button type="button" className="link" onClick={() => setRerun(x => x + 1)}>Run again</button>
        </div>
        <div className="ev-tile good"><b>{hPass}/{S.length}</b><span>scenarios pass, hardened · {suite.pairs.hardenedPass}/{suite.pairs.total} pairs</span></div>
        <div className="ev-tile bad"><b>{nPass}/{S.length}</b><span>scenarios pass, naive · {suite.pairs.naivePass}/{suite.pairs.total} pairs</span></div>
        <div className="ev-tile"><b>{breaks.length}/20</b><span>concepts break something measurable when removed</span></div>
      </section>

      <section className="ev-section" aria-labelledby="ev-matrix">
        <header className="ev-head">
          <div><span className="eyebrow">1 · Scenario matrix</span><h2 id="ev-matrix">Every edge case, through <em>both</em> harnesses</h2></div>
          <p>Each goal is graded in code against the final state of the world. A run passes only if every goal is met and nothing unsafe, unapproved or untrue happened.</p>
        </header>
        <div className="bp-card ev-table-card">
          <div className="bp-scroll">
            <table className="ev-table">
              <thead>
                <tr><th scope="col">Scenario</th><th scope="col" colSpan={2}>Hardened</th><th scope="col" colSpan={2}>Naive</th></tr>
                <tr className="ev-sub"><th scope="col"><span className="sr-only">Edge case</span></th><th scope="col">{domain.goals.length} goals</th><th scope="col">Result</th><th scope="col">{domain.goals.length} goals</th><th scope="col">Why it fails</th></tr>
              </thead>
              <tbody>
                {S.map(s => {
                  const hp = passes(s.hardened, G), np = passes(s.naive, G);
                  return (
                    <tr key={s.id} className={s.id === "all" ? "is-all" : s.id === "none" ? "is-none" : ""}>
                      <th scope="row">{s.label}</th>
                      <td><Goals domain={domain} o={s.hardened} /></td>
                      <td><span className={"chip " + (hp ? "good" : "bad")}>{hp ? "Pass" : "Fail"}</span></td>
                      <td><Goals domain={domain} o={s.naive} /></td>
                      <td className="ev-why">{np ? <span className="chip good">Pass</span> : why(s.naive, G)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="ev-foot">
            Goals, in order: {domain.goals.map(g => g.label).join(" · ")}. Plus every pair of edge cases ({suite.pairs.total} more scenarios per harness): hardened passes {suite.pairs.hardenedPass}, naive {suite.pairs.naivePass}.
            {suite.pairs.worstNaive && <> The naive harness does worst on <b>{suite.pairs.worstNaive.toLowerCase()}</b>.</>}
          </p>
        </div>
      </section>

      <section className="ev-section" aria-labelledby="ev-ablation">
        <header className="ev-head">
          <div><span className="eyebrow">2 · Ablation</span><h2 id="ev-ablation">Take one piece away. <em>What breaks?</em></h2></div>
          <p>The hardened harness with every edge case on, and one concept switched off at a time. It's how you prove each piece of the harness earns its complexity, and that the graders would notice if it regressed.</p>
        </header>
        <ol className="ev-ablations">
          {breaks.map(a => {
            const c = CONCEPT_BY_ID[a.concept];
            return (
              <li key={a.concept} className="bp-card ev-abl">
                <div className="ev-abl-top">
                  <a href={href(`/concepts/${c.slug}`)} className="ev-abl-name">Without {c.label.toLowerCase()}</a>
                  <span className="ev-bar" aria-hidden="true"><i style={{ width: `${(a.goalsLost / maxLost) * 100}%` }} /></span>
                  <span className="ev-lost">{a.goalsLost > 0 ? `−${a.goalsLost} goal${a.goalsLost === 1 ? "" : "s"}` : "goals held"}</span>
                </div>
                <div className="bp-chips">
                  {a.effects.filter(e => e.worse).map(e => <span key={e.label} className="chip bad">{e.label}: {e.before} → {e.after}</span>)}
                </div>
                {a.newIncidents.length > 0 && <p className="ev-incidents">{a.newIncidents.join(" · ")}</p>}
              </li>
            );
          })}
        </ol>
        <div className="ev-quiet">
          {silent.length > 0 && (
            <div className="bp-card">
              <b>Missed, but no outcome changed</b>
              <p>The concept came up and wasn't handled, yet every goal still held, because another layer caught it or the cost is invisible to outcome graders (tokens, a wider tool list). The concept board flags these: {silent.map(a => CONCEPT_BY_ID[a.concept].label.toLowerCase()).join(", ")}.</p>
            </div>
          )}
          {structural.length > 0 && (
            <div className="bp-card">
              <b>Structural in this scenario</b>
              <p>Switching these off changes nothing measurable here, because they're part of how every run works or this scenario doesn't exercise them: {structural.map(a => CONCEPT_BY_ID[a.concept].label.toLowerCase()).join(", ")}.</p>
            </div>
          )}
        </div>
      </section>

      <section className="ev-section" aria-labelledby="ev-grading">
        <header className="ev-head">
          <div><span className="eyebrow">3 · Grading</span><h2 id="ev-grading">Graded against the world, <em>not</em> the model's word</h2></div>
          <p>An agent's final message is a claim. Each grader reads the real state after the run and decides for itself, then compares it with what the agent said.</p>
        </header>
        <div className="ev-graders">
          {domain.goals.map(g => {
            const h = S.filter(s => ["done", "fallback"].includes(s.hardened.goals[g.id])).length;
            const n = S.filter(s => ["done", "fallback"].includes(s.naive.goals[g.id])).length;
            return (
              <div key={g.id} className="bp-card ev-grader">
                <b>{g.label}</b>
                <span className="mono">code check on the final state</span>
                <div className="ev-rates"><span className="good">{h}/{S.length}</span> hardened <span className="bad">{n}/{S.length}</span> naive</div>
              </div>
            );
          })}
          <div className="bp-card ev-grader">
            <b>Final answer is true</b>
            <span className="mono">claims vs state</span>
            <div className="ev-rates"><span className="good">{S.filter(s => !s.hardened.result.falseClaims).length}/{S.length}</span> hardened <span className="bad">{S.filter(s => !s.naive.result.falseClaims).length}/{S.length}</span> naive</div>
          </div>
        </div>
      </section>

      <section className="ev-section" aria-labelledby="ev-gate">
        <header className="ev-head">
          <div><span className="eyebrow">4 · Release gate</span><h2 id="ev-gate">What a new version must pass <em>to ship</em></h2></div>
          <p>A new model, prompt or harness change runs this whole suite first. It's enforced in CI: <code>tests/evals.test.ts</code> runs it on every push, and a failed check blocks the deploy.</p>
        </header>
        <div className={"bp-card ev-gate" + (gatePass ? " is-pass" : " is-fail")}>
          <div className="ev-gate-head"><b>{gatePass ? "Ready to ship" : "Blocked"}</b><span>{suite.gate.filter(g => g.pass).length} of {suite.gate.length} checks pass</span></div>
          <table className="ev-table">
            <thead><tr><th scope="col">Check</th><th scope="col">Target</th><th scope="col">This version</th><th scope="col"><span className="sr-only">Result</span></th></tr></thead>
            <tbody>
              {suite.gate.map(g => (
                <tr key={g.id}><th scope="row">{g.label}</th><td className="mono">{g.target}</td><td className="mono">{g.value}</td><td><span className={"chip " + (g.pass ? "good" : "bad")}>{g.pass ? "✓ Pass" : "✕ Fail"}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
