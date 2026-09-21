import { useEffect, useState } from "react";
import { CONCEPTS, GROUPS } from "../engine/concepts";
import { allSwitches, runInstant } from "../engine/run";
import type { RunResult } from "../engine/types";
import { DOMAINS } from "../domains";
import { LoopFigure } from "../components/LoopFigure";
import { href } from "../router";

type Scores = Record<string, { h: RunResult; n: RunResult }>;

export function Home() {
  const [scores, setScores] = useState<Scores>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Scores = {};
      for (const d of DOMAINS) {
        const all = allSwitches(d);
        out[d.id] = { h: (await runInstant(d, "hardened", all)).result!, n: (await runInstant(d, "naive", all)).result! };
      }
      if (alive) setScores(out);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="wrap">
      <section className="hero">
        <div>
          <p className="eyebrow">harness-hub</p>
          <h1>The model is the engine. <em>The harness is the car.</em></h1>
          <p className="lede">
            An AI agent is a model plus everything around it: the context it sees, the tools it can call, the loop that keeps it going,
            and the guardrails that stop it doing damage. harness-hub rebuilds everyday systems as agent harnesses, so you can watch
            each of those pieces work, and see what breaks when they're missing.
          </p>
          <div className="hero-ctas">
            <a className="btn-link primary" href={href("/d/butler")}>Run the home butler →</a>
            <a className="btn-link ghost" href={href("/concepts")}>Learn the 20 concepts</a>
          </div>
          <p className="cite">
            Framing borrowed from the VS Code team's write-up,{" "}
            <a href="https://code.visualstudio.com/blogs/2026/05/15/agent-harnesses-github-copilot-vscode" target="_blank" rel="noreferrer">The Coding Harness Behind GitHub Copilot in VS Code</a>.
          </p>
        </div>
        <LoopFigure />
      </section>

      <section aria-labelledby="domains-h">
        <div className="section-head">
          <h2 id="domains-h">Four harnesses, every edge case</h2>
          <p>Each one runs the same scenario through a hardened harness and a naive one. The numbers below come from running them just now, with every edge case switched on.</p>
        </div>
        <div className="domain-grid">
          {DOMAINS.map(d => {
            const s = scores[d.id];
            return (
              <a key={d.id} className="domain-card" href={href(`/d/${d.id}`)}>
                <span className="num">Prototype {d.number}</span>
                <h3>{d.title.replace(/^The /, "")}</h3>
                <p>{d.tagline}</p>
                {d.live && <span className="live-badge">Live model mode</span>}
                <div className="vs" aria-label="Hardened vs naive results">
                  <b></b><b>Hardened</b><b>Naive</b>
                  <span>Goals met</span><span className="h">{s ? `${s.h.goals} / ${d.goals.length}` : "…"}</span><span className="n">{s ? `${s.n.goals} / ${d.goals.length}` : "…"}</span>
                  <span>Safety incidents</span><span className="h">{s ? s.h.safety : "…"}</span><span className="n">{s ? s.n.safety : "…"}</span>
                  <span>False claims</span><span className="h">{s ? s.h.falseClaims : "…"}</span><span className="n">{s ? s.n.falseClaims : "…"}</span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="concepts-h">
        <div className="section-head">
          <h2 id="concepts-h">The 20 concepts</h2>
          <p>Every trace card is tagged with the concepts it exercises. Each guide explains the idea, the failure it prevents, and how to build it, then links to where it happens in each harness.</p>
        </div>
        <div className="concept-groups">
          {GROUPS.map(g => (
            <div key={g} className="concept-col">
              <h3>{g}</h3>
              <ul>
                {CONCEPTS.filter(c => c.group === g).map(c => (
                  <li key={c.id}><a href={href(`/concepts/${c.slug}`)}>{c.label}<span>{c.summary}</span></a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="callout">
        <div>
          <h2>Add the next harness</h2>
          <p>A domain is one TypeScript file: its tools, goals, edge cases and beats. The engine, the concept board, the scorecard and the tests come for free.</p>
        </div>
        <a className="btn-link primary" href={href("/contribute")}>How to contribute →</a>
      </section>
    </div>
  );
}
