import { CONCEPTS, CONCEPT_BY_SLUG, GROUPS } from "../engine/concepts";
import { DOMAINS } from "../domains";
import { href } from "../router";
import { NotFound } from "./NotFound";

export function ConceptsIndex() {
  return (
    <div className="page">
      <header className="page-hero center">
        <p className="eyebrow">The guide</p>
        <h1>Twenty concepts of harness engineering.</h1>
        <p className="lede">Grouped the way they show up in a run: what the model sees, what it can do, how the loop is kept in check, what keeps it safe, and how you know it worked.</p>
      </header>
      <div className="concept-index">
        {GROUPS.map(g => (
          <section key={g} className="ci-group" aria-labelledby={"g-" + g}>
            <h2 id={"g-" + g}>{g}</h2>
            <ul>
              {CONCEPTS.filter(c => c.group === g).map(c => (
                <li key={c.id}>
                  <a href={href(`/concepts/${c.slug}`)}>
                    <b>{c.label}</b>
                    <span>{c.summary}</span>
                    <i aria-hidden="true">›</i>
                  </a>
                </li>
              ))}
            </ul>
          </section>
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
    <div className="page doc">
      <nav className="doc-nav" aria-label="All concepts">
        {GROUPS.map(g => (
          <div key={g}>
            <p>{g}</p>
            <ul>
              {CONCEPTS.filter(x => x.group === g).map(x => (
                <li key={x.id}><a href={href(`/concepts/${x.slug}`)} aria-current={x.id === c.id ? "page" : undefined}>{x.label}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <article className="doc-body">
        <p className="crumbs"><a href={href("/concepts")}>Concepts</a><span aria-hidden="true">/</span>{c.group}</p>
        <h1>{c.label}</h1>
        <p className="lede">{c.summary}</p>

        <h2>Why it matters</h2>
        <p>{c.why}</p>

        <div className="callout bad">
          <p className="callout-title">Without it</p>
          <p>{c.without}</p>
        </div>

        <h2>How to build it</h2>
        <p>{c.build}</p>
        <pre className="code"><code>{c.sketch}</code></pre>

        <h2>See it in each harness</h2>
        <ul className="in-domain">
          {DOMAINS.map(d => (
            <li key={d.id}>
              <a href={href(`/d/${d.id}?concept=${c.id}`)}>
                <b>{d.shortTitle}</b>
                <span>{d.concepts[c.id]}</span>
                <i aria-hidden="true">›</i>
              </a>
            </li>
          ))}
        </ul>

        <nav className="pager" aria-label="More concepts">
          {prev ? <a href={href(`/concepts/${prev.slug}`)}><small>Previous</small>{prev.label}</a> : <span />}
          {next ? <a className="next" href={href(`/concepts/${next.slug}`)}><small>Next</small>{next.label}</a> : <span />}
        </nav>
      </article>
    </div>
  );
}
