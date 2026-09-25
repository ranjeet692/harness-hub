import type { ReactNode } from "react";
import { CONCEPT_BY_ID } from "../engine/concepts";
import { DOMAINS } from "../domains";
import { href } from "../router";
import { exampleDesign } from "../blueprint/example";
import { CONCEPT_IDS, CONCEPT_LABEL, CONCEPT_STEP, QUESTION, RISKS, STEPS, analyze, verdict, type StepId } from "../blueprint/model";
import { Highlighted } from "./BlueprintBuilder";

const SAMPLE = "Read vendor invoices from email, match them to the PO in SAP, and pay anything under ₹5 lakh. Bigger ones need the controller's approval. Never pay a vendor twice.";

const PASSES = [
  { n: "01", pass: "Read", title: "Requirement", text: "Highlight the phrases that imply harness work. Decide whether it's an agent at all, or a workflow with one smart step.", tags: ["phrase → concept", "agent or workflow?"] },
  { n: "02", pass: "HLD", title: "What and why", text: "The job and a “done” you can check. The world: sources of truth, reads and writes. Autonomy per action. Risks. The loop's shape.", tags: ["job", "world", "autonomy", "risks"] },
  { n: "03", pass: "LLD", title: "How, exactly", text: "The tool table with tiers, keys, timeouts and undo. What goes in the context. The guards. Loop limits. Subagent briefs.", tags: ["tools", "context", "guards", "loop control"] },
  { n: "04", pass: "Verify", title: "Prove it", text: "Every requirement traced to a concept, an edge case and a number. Run hardened against naive. Nothing ships with a concept left open.", tags: ["traceability", "edge cases", "scorecard"] },
];

export function BlueprintHome() {
  const sample = analyze(SAMPLE).filter(f => f.rule.concept !== "stophook");
  return (
    <div className="bp-home">
      <section className="bp-hero">
        <div className="bp-hero-text">
          <p className="eyebrow">Blueprint · requirement → HLD → LLD → verify</p>
          <h1>From a requirement<br />to a <em>harness.</em></h1>
          <p className="lede">A client asks for “an AI that handles our invoices.” Blueprint turns that sentence into a design you can defend: what the agent may touch, what it must never do, where a person decides, and the tests that prove it.</p>
          <div className="hero-cta">
            <a className="btn btn-primary btn-lg" href={href("/blueprint/build/requirement")}>Start with your requirement</a>
            <a className="more" href={href("/blueprint/guide")}>Read the guide <span aria-hidden="true">›</span></a>
          </div>
        </div>
        <div className="bp-redline">
          <span className="eyebrow">A client requirement, redlined</span>
          <Highlighted text={SAMPLE} findings={sample} />
          <ul>
            {sample.filter(f => f.rule.concept !== "workflow").slice(0, 6).map((f, i) => (
              <li key={i}><span className="chip o">{f.rule.label}</span><span>{f.rule.then}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="h-who">
        <div className="section-head">
          <h2 id="h-who">For whoever holds the <em>requirement</em></h2>
          <p>The same method, three ways in. No sign-up; everything stays in your browser.</p>
        </div>
        <div className="bp-who">
          <div className="bp-who-card">
            <span className="chip">Developers new to AI</span>
            <h3>You can build software. Now build the loop around a model.</h3>
            <p>Every step maps to things you already know: schemas, retries, idempotency keys, tests. The design exports as a harness skeleton you can run on this site.</p>
            <span className="mono dim">Leaves with a design doc and a runnable skeleton</span>
          </div>
          <div className="bp-who-card">
            <span className="chip">Consultants &amp; solution architects</span>
            <h3>Walk into the client meeting with the risks already found.</h3>
            <p>A plain-language summary a business owner can sign off, the questions to ask them, and a traceability matrix that shows every requirement is covered.</p>
            <span className="mono dim">Leaves with a client proposal and open questions</span>
          </div>
          <div className="bp-who-card">
            <span className="chip">Indie builders &amp; hobbyists</span>
            <h3>Ship the weekend agent without the 2 a.m. surprise.</h3>
            <p>Paste your idea, mark the risks that apply, and decide the handful of guards that matter before you give it your card or your inbox.</p>
            <span className="mono dim">Leaves with a design doc and an eval checklist</span>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="h-method">
        <div className="section-head">
          <h2 id="h-method">The method, in <em>four</em> passes</h2>
          <p>Nine steps in all. Every one ends in a decision you can point to, and each of the 20 concepts is decided in exactly one of them.</p>
        </div>
        <ol className="bp-passes">
          {PASSES.map(p => (
            <li key={p.n}>
              <span className="mono accent">{p.n} · {p.pass}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <div className="bp-chips">{p.tags.map(t => <span key={t} className="chip">{t}</span>)}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="section bp-ways" aria-label="Ways in">
        <a className="bp-way" href={href("/blueprint/guide")}>
          <span className="eyebrow">Learn</span>
          <h3>The guide</h3>
          <p>Nine steps, each with the questions to ask and a worked answer from a real requirement: an invoice agent for a finance team.</p>
          <span className="more">Read the guide <span aria-hidden="true">›</span></span>
        </a>
        <a className="bp-way" href={href(`/d/${DOMAINS[DOMAINS.length - 1].id}/blueprint`)}>
          <span className="eyebrow">See</span>
          <h3>Six blueprints</h3>
          <p>Every harness on the hub, reverse-engineered into its design. Each row links to the moment it mattered in the run.</p>
          <span className="more">Start with onboarding <span aria-hidden="true">›</span></span>
        </a>
        <a className="bp-way is-dark" href={href("/blueprint/build/requirement")}>
          <span className="eyebrow">Build</span>
          <h3>The builder</h3>
          <p>Paste your requirement, answer what it raises, and leave with a design doc, a client proposal, an eval checklist and a harness skeleton.</p>
          <span className="more">Open the builder <span aria-hidden="true">›</span></span>
        </a>
      </section>
    </div>
  );
}

const WHY: Record<StepId, string> = {
  requirement: "Most of the design is already in the client's words. “Under ₹5 lakh” is a budget guard, “approved by” is a gate, “by email” is an injection surface, “never twice” is an idempotency key. Read for those phrases first. Then ask the question that saves the most money: does this need an agent at all? Fixed steps are cheaper, testable and can't go rogue; put a model loop only where judgment is needed.",
  job: "A job you can't check is a job an agent can claim to have done. Write it as an outcome with a deadline, then list what must be true, each line something code can verify against a real system. Those lines become your stop hook and your scorecard.",
  world: "Every system the agent touches keeps its own copy of the facts, and copies go stale. Name the source of truth for each fact and re-read it before every write. Then set autonomy per action, not per agent: reading can be free while paying needs a person and changing bank details is never offered.",
  risks: "Money, irreversible actions, personal data, outsiders, untrusted text, the physical world, secrets and unattended volume. Each risk you mark brings the concepts that answer it, so the later steps can't quietly skip them.",
  loop: "How the agent thinks, remembers and stops. What goes in the prompt each round, what's pinned, what's summarized when the window fills, whether reads run in parallel, what goes to a subagent, and what counts as stuck.",
  tools: "The tool table is the contract between the model and the world. For each tool: its tier (safe, asks first, never exposed), what arguments are checked before it runs, how it's retried, how long it may take, the key that stops a retry from doing it twice, and how it's undone.",
  guards: "The rules a prompt can't enforce. Approvals with a safe default and a plan for when nobody answers. Hard limits in code. Untrusted text wrapped as data. And the stop hook: what must be true, checked in code, before “done”.",
  evals: "Trace every client sentence to a concept, an edge case you can switch on, and a number that must hold. That table is your answer to “how do you know it's safe?”, and the edge cases become the switches in a harness-hub run.",
  export: "One design, four audiences: a plain-language proposal for the client, the full design doc for engineers, a harness skeleton for builders and an eval checklist for QA.",
};

export function BlueprintGuide() {
  const ex = exampleDesign();
  const findings = analyze(ex.requirement);
  const v = verdict(ex.requirement);
  const example: Record<StepId, ReactNode> = {
    requirement: <><Highlighted text={ex.requirement} findings={findings} /><p><b>Verdict:</b> {v.title}. Fetching, extracting, paying and the daily summary are fixed steps; only matching an invoice to its order and receipt needs judgment.</p></>,
    job: <><p><b>Job:</b> {ex.job}</p><ul>{ex.done.map(x => <li key={x}>{x}</li>)}</ul></>,
    world: <><ul>{ex.world.map(s => <li key={s.name}><b>{s.name}</b> · {s.access}{s.truth ? " · source of truth" : ""}{s.money ? " · moves money" : ""}{s.untrusted ? " · untrusted text" : ""}</li>)}</ul>
      <ul>{ex.actions.map(a => <li key={a.label}>{a.label}: <b>{a.autonomy === "alone" ? "acts alone" : a.autonomy === "approve" ? "asks first" : a.autonomy}</b></li>)}</ul></>,
    risks: <ul>{RISKS.filter(r => ex.risks[r.id]).map(r => <li key={r.id}>{r.label}</li>)}</ul>,
    loop: null, tools: <ul>{ex.tools.map(t => <li key={t.name}><code>{t.name}</code> · {t.tier === "confirm" ? "asks first" : t.tier === "never" ? "never exposed" : "safe"}{t.key ? ` · key: ${t.key}` : ""}</li>)}</ul>,
    guards: null,
    evals: <ul>{ex.trace.map(t => <li key={t.said}>{t.said} → {CONCEPT_LABEL[t.concept]} → {t.edge} → <b>{t.hold}</b></li>)}</ul>,
    export: null,
  };
  return (
    <div className="page bp-guide">
      <header className="page-hero">
        <p className="crumbs"><a href={href("/blueprint")}>Blueprint</a><span aria-hidden="true">/</span>Guide</p>
        <h1>From requirement to <em>harness</em></h1>
        <p className="lede">Nine steps, in four passes. Each step lists the questions to answer and shows the worked example: an invoice agent for a finance team. About 25 minutes to read.</p>
        <a className="btn btn-primary" href={href("/blueprint/build/requirement")}>Try it on your own requirement</a>
      </header>
      <ol className="bp-guide-steps">
        {STEPS.map((s, i) => {
          const ids = CONCEPT_IDS.filter(id => CONCEPT_STEP[id] === s.id);
          return (
            <li key={s.id} id={s.id}>
              <header><span className="mono accent">{String(i + 1).padStart(2, "0")} · {s.pass}</span><h2>{s.label}</h2></header>
              <p>{WHY[s.id]}</p>
              {ids.length > 0 && (
                <div className="bp-guide-qs">
                  <h3>Decide</h3>
                  <dl>{ids.map(id => (
                    <div key={id}>
                      <dt><a href={href(`/concepts/${CONCEPT_BY_ID[id].slug}`)}>{CONCEPT_LABEL[id]}</a></dt>
                      <dd>{QUESTION[id]}<span className="bp-guide-ans"><b>Example:</b> {ex.concepts[id].status === "na" ? "Not needed. " : ""}{ex.concepts[id].note}</span></dd>
                    </div>
                  ))}</dl>
                </div>
              )}
              {example[s.id] && <div className="bp-guide-ex"><h3>In the example</h3>{example[s.id]}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
