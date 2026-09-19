import { useState } from "react";
import type { ConceptId } from "../engine/concepts";
import { CONCEPT_BY_ID } from "../engine/concepts";
import { DOMAIN_BY_ID } from "../domains";
import { Console } from "../components/Console";
import { LiveConsole } from "../live/LiveConsole";
import { NotFound } from "./NotFound";

export function DomainPage({ id, concept }: { id: string; concept?: string | null }) {
  const domain = DOMAIN_BY_ID[id];
  const [tab, setTab] = useState<"scripted" | "live">("scripted");
  if (!domain) return <NotFound />;
  const focus = concept && concept in CONCEPT_BY_ID ? (concept as ConceptId) : undefined;
  return (
    <div className="page">
      <header>
        <p className="eyebrow">{domain.eyebrow}</p>
        <h1>{domain.title}</h1>
        <p className="dek">{domain.dek}</p>
        <p className="request"><b>{domain.requestLabel}</b>{domain.request}</p>
      </header>

      <div className="tabs" role="tablist" aria-label="Run mode">
        <button type="button" role="tab" className="tab" aria-selected={tab === "scripted"} onClick={() => setTab("scripted")}>Scripted run</button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "live"} disabled={!domain.live}
          title={domain.live ? undefined : "Live model mode is available for the barista first"} onClick={() => setTab("live")}>
          Live model{domain.live ? "" : " (coming soon)"}
        </button>
      </div>

      {tab === "scripted" || !domain.live
        ? <Console key={domain.id + (focus ?? "")} domain={domain} focusConcept={focus} />
        : <LiveConsole domain={domain} spec={domain.live} />}

      <footer className="colophon">
        <p>
          <strong>Scripted run:</strong> the model's choices are fixed so every run is repeatable, and what varies is how the harness responds.
          {domain.live
            ? <> <strong>Live model:</strong> a real Claude model makes the decisions through the same harness rules, against a simulated world.</>
            : " Live model mode is built for the barista first and follows for this domain."}
        </p>
      </footer>
    </div>
  );
}
