import { CONCEPT_BY_ID } from "../engine/concepts";
import type { Domain } from "../engine/types";
import { href } from "../router";
import { BLUEPRINTS } from "../blueprint/domains";
import { CONCEPT_LABEL } from "../blueprint/model";

const ROLE: Record<string, string> = { truth: "source of truth", read: "read", write: "write", money: "write · money", person: "person", device: "device" };

/** A harness, reverse-engineered into its design: the HLD, the tool tiers, and a traceability
    matrix whose rows open the run at the moment each decision mattered. */
export function BlueprintTab({ domain }: { domain: Domain }) {
  const bp = BLUEPRINTS[domain.id];
  if (!bp) return <p className="fineprint">No blueprint for this harness yet.</p>;
  const sw = Object.fromEntries(domain.switches.map(s => [s.id, s.label]));
  return (
    <div className="bp-tab">
      <div className="bp-tab-hld">
        <section className="bp-card">
          <div className="bp-card-head"><span className="eyebrow">HLD · The job</span><span className="chip">checkable</span></div>
          <p className="bp-big">{bp.job}</p>
          <p>{bp.done}</p>
        </section>
        <section className="bp-card">
          <span className="eyebrow">HLD · World</span>
          <ul className="bp-world">
            {bp.world.map(w => <li key={w.name} className={"is-" + w.role}><b>{w.name}</b><span>{ROLE[w.role]}</span></li>)}
          </ul>
          <p className="fineprint">Untrusted text: {bp.untrusted}</p>
        </section>
        <section className="bp-card">
          <span className="eyebrow">HLD · Autonomy</span>
          <dl className="bp-auto">
            <dt className="alone">Alone</dt><dd>{bp.autonomy.alone}</dd>
            <dt className="approve">Asks first</dt><dd>{bp.autonomy.approve}</dd>
            <dt className="never">Never</dt><dd>{bp.autonomy.never}</dd>
          </dl>
        </section>
        <section className="bp-card">
          <span className="eyebrow">HLD · Loop shape</span>
          <p>{bp.loop}</p>
        </section>
      </div>

      <section className="bp-card bp-trace">
        <div className="bp-card-head">
          <div><span className="eyebrow">Traceability</span><h3>Every edge case traces back to the request</h3></div>
          <span className="fineprint">Open a row to see that moment in the run</span>
        </div>
        <div className="bp-scroll">
          <table className="bp-table is-read">
            <thead><tr><th scope="col">The request</th><th scope="col">Concept</th><th scope="col">Edge case (switch)</th><th scope="col">Must hold</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {bp.trace.map((t, i) => (
                <tr key={i}>
                  <td><b>{t.said}</b></td>
                  <td><a className="chip o" href={href(`/concepts/${CONCEPT_BY_ID[t.concept].slug}`)}>{CONCEPT_LABEL[t.concept]}</a></td>
                  <td>{t.edge}<small>{sw[t.sw] ? `switch: ${sw[t.sw]}` : ""}</small></td>
                  <td className="mono good">{t.hold}</td>
                  <td><a href={href(`/d/${domain.id}?concept=${t.concept}`)}>▶ In the run</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bp-tiers">
          <div><span className="eyebrow">LLD · Safe</span><code>{bp.tools.safe.join(" · ")}</code></div>
          <div><span className="eyebrow">LLD · Asks first</span><code>{bp.tools.confirm.join(" · ")}</code></div>
          <div><span className="eyebrow">LLD · Never exposed</span><code>{bp.tools.never.join(" · ")}</code></div>
        </div>
      </section>

      <div className="bp-tab-cta">
        <p>Designing something like this? The builder walks you through the same decisions for your own requirement.</p>
        <a className="btn btn-primary" href={href("/blueprint/build/requirement")}>Start a blueprint</a>
      </div>
    </div>
  );
}
