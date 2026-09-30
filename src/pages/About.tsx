import { CONCEPTS } from "../engine/concepts";
import { DOMAINS } from "../domains";
import { href } from "../router";
import { SITE } from "../site";

/* The author page: what harness-hub demonstrates, with a link to the evidence for each claim. */

const EDGE_CASES = DOMAINS.reduce((n, d) => n + d.switches.length, 0);

const SHOWS: { title: string; text: string; link: [string, string] }[] = [
  { title: "Harness architecture", text: "A deterministic run engine shared by every scenario: rounds, beats, tool calls, approvals and scoring. A new agent is one TypeScript module; the timeline, concept board and scorecard come with it.", link: ["How a harness is built", "/contribute"] },
  { title: "Safety in code, not in prompts", text: "Tool tiers, confirmation gates with safe defaults, budget guards, injection defense, idempotency keys and compensation, each enforced by the harness and exercised by an edge case you can switch on.", link: ["The 20 concepts", "/concepts"] },
  { title: "Evaluation", text: "Every scenario runs twice, hardened and naive, and is scored on goals met, safety incidents, false claims and domain metrics. A shared test suite holds every harness to the same bar: all 20 concepts handled, zero incidents.", link: ["See a scorecard", "/d/coding"] },
  { title: "Real models, real code", text: "Live mode puts a real Claude model in the loop through the same harness, straight from the browser. In the coding agent, the model's fix really runs: tests execute in a sandboxed Web Worker with a time limit.", link: ["Try the live coding agent", "/d/coding"] },
  { title: "Enterprise integration", text: "The onboarding agent works across HR, payroll, finance, identity, procurement, facilities and IT, with HR as the source of truth. It re-reads before every write, scopes personal data per system and reconciles field by field.", link: ["Open the onboarding agent", "/d/onboarding"] },
  { title: "From requirement to design", text: "Blueprint turns a client's requirement into a high-level and low-level design, traces every sentence to a test, and exports a client proposal, a design doc and a runnable skeleton.", link: ["Open Blueprint", "/blueprint"] },
];

const PRINCIPLES = [
  ["Controls live in code.", "If a rule matters, the harness enforces it. A missing tool can't be talked around; a sentence in a prompt can."],
  ["Check the world, not the model's word.", "“Done” is decided by reading the real state: the diff, the ledger, the HR record."],
  ["Design the failure path first.", "Timeouts, duplicates, stale data and hostile text are the normal case at scale. Each one gets a switch and a test."],
  ["Put people where the risk is.", "Autonomy is set per action. Reading is free, paying asks first, changing bank details is never offered."],
];

export function About() {
  const a = SITE.author;
  return (
    <div className="page about-page">
      <header className="page-hero">
        <p className="crumbs"><a href={href("/")}>Home</a><span aria-hidden="true">/</span>About</p>
        <p className="eyebrow">Built by {a.name}</p>
        <h1>I build the <em>harness</em> around the model.</h1>
        <p className="lede">
          harness-hub is my working proof of AI engineering: {DOMAINS.length} agents, {CONCEPTS.length} harness concepts and {EDGE_CASES} edge cases,
          each one implemented, run, scored and tested. It's the part of an AI product that decides whether the model can be trusted to act.
        </p>
        <div className="hero-cta about-cta">
          <a className="btn btn-primary" href={a.github} target="_blank" rel="noreferrer me">GitHub profile</a>
          {a.linkedin && <a className="btn btn-secondary" href={a.linkedin} target="_blank" rel="noreferrer me">LinkedIn</a>}
          {a.website && <a className="btn btn-secondary" href={a.website} target="_blank" rel="noreferrer me">Website</a>}
          <a className="more" href={SITE.repo} target="_blank" rel="noreferrer">Read the source <span aria-hidden="true">›</span></a>
        </div>
      </header>

      <section className="about-section" aria-labelledby="h-shows">
        <h2 id="h-shows">What this project <em>demonstrates</em></h2>
        <div className="about-grid">
          {SHOWS.map(s => (
            <article key={s.title} className="about-card">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <a href={href(s.link[1])}>{s.link[0]} <span aria-hidden="true">›</span></a>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" aria-labelledby="h-how">
        <h2 id="h-how">How I <em>work</em></h2>
        <dl className="about-principles">
          {PRINCIPLES.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
        </dl>
      </section>

      <section className="about-section about-stack" aria-labelledby="h-stack">
        <h2 id="h-stack">Under the <em>hood</em></h2>
        <ul>
          <li><b>TypeScript, React 19, Vite.</b> Every page is prerendered to static HTML for search and sharing, then runs as an app.</li>
          <li><b>A scripted engine and a live one.</b> Scripted runs are repeatable, so every claim on the site is reproducible; live runs use the Anthropic API from your browser.</li>
          <li><b>Tests as the spec.</b> Vitest runs every harness in both modes and checks the scorecards, plus unit tests for reconciliation, diagram verification and Blueprint.</li>
          <li><b>Open source, MIT.</b> <a href={SITE.repo} target="_blank" rel="noreferrer">github.com/ranjeet692/harness-hub</a></li>
        </ul>
      </section>

      <section className="cta-band">
        <h2>Building an <em>agent</em>?</h2>
        <p>If you're taking an AI agent from prototype to production, I'd like to hear about it.</p>
        <div className="hero-cta">
          <a className="btn btn-primary btn-lg" href={a.linkedin || a.github} target="_blank" rel="noreferrer me">Get in touch</a>
          <a className="more" href={href("/blueprint")}>Or design it with Blueprint <span aria-hidden="true">›</span></a>
        </div>
      </section>
    </div>
  );
}
