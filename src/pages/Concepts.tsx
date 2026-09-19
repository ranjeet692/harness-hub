import { CONCEPTS, CONCEPT_BY_SLUG, GROUPS } from "../engine/concepts";
import { DOMAINS } from "../domains";
import { href } from "../router";
import { NotFound } from "./NotFound";

export function ConceptsIndex() {
  return (
    <div className="wrap">
      <header>
        <p className="eyebrow">Guide</p>
        <h1>20 concepts of harness engineering</h1>
        <p className="dek">Grouped the way they show up in a run: what the model sees, what it can do, how the loop is kept in check, what keeps it safe, and how you know it worked.</p>
      </header>
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
    </div>
  );
}

export function ConceptPage({ slug }: { slug: string }) {
  const c = CONCEPT_BY_SLUG[slug];
  if (!c) return <NotFound />;
  const i = CONCEPTS.indexOf(c);
  const prev = CONCEPTS[i - 1], next = CONCEPTS[i + 1];
  return (
    <div className="wrap narrow">
      <article className="prose">
        <p className="crumbs"><a href={href("/concepts")}>Concepts</a> · {c.group}</p>
        <h1>{c.label}</h1>
        <p className="dek" style={{ fontSize: 19 }}>{c.summary}</p>

        <div className="facts">
          <div className="fact"><h3>Why it matters</h3><p>{c.why}</p></div>
          <div className="fact bad"><h3>Without it</h3><p>{c.without}</p></div>
          <div className="fact"><h3>How to build it</h3><p>{c.build}</p></div>
        </div>

        <h2>A sketch</h2>
        <pre><code>{c.sketch}</code></pre>

        <h2>See it in each harness</h2>
        <div className="in-domain">
          {DOMAINS.map(d => (
            <a key={d.id} href={href(`/d/${d.id}?concept=${c.id}`)}>
              <b>{d.shortTitle}</b>
              <span>{d.concepts[c.id]}</span>
              <span className="go">Open trace →</span>
            </a>
          ))}
        </div>

        <nav className="pager" aria-label="More concepts">
          {prev ? <a href={href(`/concepts/${prev.slug}`)}>← {prev.label}</a> : <span />}
          {next ? <a href={href(`/concepts/${next.slug}`)}>{next.label} →</a> : <span />}
        </nav>
      </article>
    </div>
  );
}
