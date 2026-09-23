import { useEffect, useState } from "react";
import { CONCEPTS, GROUPS } from "../engine/concepts";
import { allSwitches, runInstant, type Run } from "../engine/run";
import type { RunResult } from "../engine/types";
import { DOMAINS, DOMAIN_BY_ID } from "../domains";
import { CodeEditor } from "../domains/coding/Editor";
import { LoopFigure } from "../components/LoopFigure";
import { href } from "../router";

type Scores = Record<string, { h: RunResult; n: RunResult }>;

const GROUP_BLURB: Record<string, string> = {
  "Context": "What the model sees each round, and what it must never forget.",
  "Tools": "What the model can do, and how bad calls are caught.",
  "Loop control": "How the loop recovers, retries, and knows when to stop.",
  "Safety": "What needs a person, what's capped, and what's never trusted.",
  "Evaluation": "How you know the harness is getting better.",
};

export function Home() {
  const [scores, setScores] = useState<Scores>({});
  const [demo, setDemo] = useState<Run | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Scores = {};
      for (const d of DOMAINS) {
        const all = allSwitches(d);
        out[d.id] = { h: (await runInstant(d, "hardened", all)).result!, n: (await runInstant(d, "naive", all)).result! };
      }
      const coding = DOMAIN_BY_ID.coding;
      const shot = await runInstant(coding, "hardened", allSwitches(coding));
      if (alive) { setScores(out); setDemo(shot); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">An open-source playground for people who build AI agents</p>
        <h1>The model is the engine.<br /><span>The <em>harness</em> is the car.</span></h1>
        <p className="lede">
          Six everyday agents, each run twice: once inside a hardened harness, once inside a naive one.
          Watch every check, every retry, and every moment the agent stops to ask you.
        </p>
        <div className="hero-cta">
          <a className="btn btn-primary btn-lg" href={href("/d/coding")}>Try the coding agent</a>
          <a className="more" href={href("/concepts")}>Learn the 20 concepts <span aria-hidden="true">›</span></a>
        </div>
      </section>

      <section className="showcase" aria-label="A finished run of the coding agent">
        <div className="showcase-frame">
          {demo ? <CodeEditor S={demo.S} /> : <div className="ide ide-placeholder" />}
        </div>
        <p className="showcase-caption">
          A hardened run of the coding agent: one fix, one regression test, the suite green, one pull request, and <code>.env</code> never touched.
        </p>
      </section>

      <section className="band">
        <div className="band-text">
          <p className="eyebrow">What's a harness?</p>
          <h2>Everything around the model that makes it safe to let it act.</h2>
          <p>
            The model only chooses the next step. The harness decides what the model sees, which tools it may call,
            what happens when a call fails, when to stop and ask a person, and whether the job was actually done.
          </p>
          <p className="cite">
            The framing comes from the VS Code team's write-up, <a href="https://code.visualstudio.com/blogs/2026/05/15/agent-harnesses-github-copilot-vscode" target="_blank" rel="noreferrer">The Coding Harness Behind GitHub Copilot in VS Code</a>.
          </p>
        </div>
        <LoopFigure />
      </section>

      <section className="section" aria-labelledby="h-harnesses">
        <div className="section-head">
          <h2 id="h-harnesses">Six harnesses. <em>Every</em> edge case.</h2>
          <p>The same scenario through both harnesses, with every edge case switched on. The numbers are computed in your browser when this page loads.</p>
        </div>
        <div className="harness-grid">
          {DOMAINS.map(d => {
            const s = scores[d.id];
            return (
              <a key={d.id} className="harness-card" href={href(`/d/${d.id}`)}>
                <div className="hc-top">
                  <span className="hc-num">Harness {d.number}</span>
                  {d.live && <span className="chip info">Live model</span>}
                </div>
                <h3>{d.shortTitle}</h3>
                <p>{d.tagline}</p>
                <dl className="hc-stats">
                  <div><dt>Goals met</dt><dd><b className="good">{s ? s.h.goals : "–"}</b><span>vs</span><b className="bad">{s ? s.n.goals : "–"}</b><small>of {d.goals.length}</small></dd></div>
                  <div><dt>Safety incidents</dt><dd><b className="good">{s ? s.h.safety : "–"}</b><span>vs</span><b className="bad">{s ? s.n.safety : "–"}</b></dd></div>
                </dl>
                <p className="hc-legend"><i className="good" />Hardened <i className="bad" />Naive</p>
                <span className="more">Open the {d.shortTitle.toLowerCase()} <span aria-hidden="true">›</span></span>
              </a>
            );
          })}
        </div>
      </section>

      <section className="section" aria-labelledby="h-how">
        <div className="section-head">
          <h2 id="h-how">How it <em>works</em></h2>
          <p>Every harness page follows the same four steps.</p>
        </div>
        <ol className="how">
          <li><b>Set up the run</b><span>Pick the hardened or naive harness and switch on the things that go wrong.</span></li>
          <li><b>Watch it play</b><span>Each model step and harness check appears as it happens. A bar at the top always says what's going on.</span></li>
          <li><b>Answer when asked</b><span>Risky steps pause the run. The question comes to you at the bottom of the screen.</span></li>
          <li><b>Compare</b><span>See which concepts the harness handled, and how the two harnesses scored side by side.</span></li>
        </ol>
      </section>

      <section className="section" aria-labelledby="h-concepts">
        <div className="section-head">
          <h2 id="h-concepts">Twenty concepts, <em>five</em> groups</h2>
          <p>Every step in a run is tagged with the concepts it exercises. Each guide covers the idea, the failure it prevents and how to build it.</p>
        </div>
        <div className="group-grid">
          {GROUPS.map(g => (
            <div key={g} className="group-card">
              <h3>{g}</h3>
              <p>{GROUP_BLURB[g]}</p>
              <ul>
                {CONCEPTS.filter(c => c.group === g).map(c => <li key={c.id}><a href={href(`/concepts/${c.slug}`)}>{c.label}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>Add the <em>next</em> harness.</h2>
        <p>A harness is one TypeScript module: its tools, goals, edge cases and steps. The engine, timeline, scorecard and tests come with it.</p>
        <div className="hero-cta">
          <a className="btn btn-primary btn-lg" href={href("/contribute")}>How to contribute</a>
          <a className="more" href="https://github.com/ranjeet692/harness-hub" target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">›</span></a>
        </div>
      </section>
    </div>
  );
}
