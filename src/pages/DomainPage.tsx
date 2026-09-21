import { useState } from "react";
import type { ConceptId } from "../engine/concepts";
import { CONCEPT_BY_ID } from "../engine/concepts";
import { DOMAIN_BY_ID } from "../domains";
import { Console } from "../components/Console";
import { LiveConsole } from "../live/LiveConsole";
import { href } from "../router";
import { NotFound } from "./NotFound";

export function DomainPage({ id, concept }: { id: string; concept?: string | null }) {
  const domain = DOMAIN_BY_ID[id];
  const [tab, setTab] = useState<"scripted" | "live">("scripted");
  if (!domain) return <NotFound />;
  const focus = concept && concept in CONCEPT_BY_ID ? (concept as ConceptId) : undefined;
  return (
    <div className="page domain-page">
      <header className="page-hero">
        <p className="crumbs"><a href={href("/")}>Harnesses</a><span aria-hidden="true">/</span>{domain.shortTitle}</p>
        <h1>{domain.title.replace(/^The /, "")}</h1>
        <p className="lede">{domain.tagline}</p>
        <div className="task">
          <span className="task-label">{domain.requestLabel}</span>
          <p>{domain.request}</p>
        </div>
      </header>

      <div className="mode-tabs" role="tablist" aria-label="How the agent is driven">
        <button type="button" role="tab" aria-selected={tab === "scripted"} onClick={() => setTab("scripted")}>
          <b>Scripted run</b><span>Repeatable. Try every edge case.</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "live"} disabled={!domain.live} onClick={() => setTab("live")}
          title={domain.live ? undefined : "Live model mode is available for the barista and the coding agent so far"}>
          <b>Live model</b><span>{domain.live ? "A real Claude model decides. Needs an API key." : "Coming soon for this harness."}</span>
        </button>
      </div>

      {tab === "scripted" || !domain.live
        ? <Console key={domain.id + (focus ?? "")} domain={domain} focusConcept={focus} />
        : <LiveConsole domain={domain} spec={domain.live} />}

      <details className="about">
        <summary>About this scenario</summary>
        <p>{domain.dek}</p>
      </details>
    </div>
  );
}
