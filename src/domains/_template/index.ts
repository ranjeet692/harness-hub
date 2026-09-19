/**
 * Template for a new harness-hub domain.
 *
 * 1. Copy this folder to src/domains/<your-id>/ and rename `template`.
 * 2. Fill in the copy, switches, goals and devices.
 * 3. Write beats: each one is an async step of the scenario with a hardened
 *    branch (S.H === true) and a naive branch. Call hit(id) when the hardened
 *    harness handles a concept, and hit(id, "miss") when the naive one fails it.
 * 4. Register the domain in src/domains/index.ts and run `npm test`.
 *
 * This file isn't registered, so it doesn't appear on the site.
 */
import type { Domain, ReportLine } from "../../engine/types";
import type { Run } from "../../engine/run";
import type { ConceptId } from "../../engine/concepts";

const TODO = "Explain how this concept shows up in your domain.";

export const template: Domain = {
  id: "template",
  number: "04",
  title: "The Template Harness",
  shortTitle: "Template",
  tagline: "One line for the home page card.",
  eyebrow: "harness-hub · prototype 04",
  dek: "Two or three sentences setting the scene and the edge cases.",
  requestLabel: "The request",
  request: "“What the user asks the agent to do.”",
  userLabel: "You",
  runLabel: "Run",
  window: 16000,
  modeHelp: {
    hardened: "Validation, gates, guards, retries done right.",
    naive: "The same model with a thin loop around it: no tiers, no validation, no guards.",
  },
  concepts: Object.fromEntries(
    (["ctx", "mem", "compact", "steer", "loop", "tiers", "parallel", "schema", "unknown", "subagent",
      "retry", "timeout", "idem", "loopguard", "stophook", "gate", "budget", "inject", "comp", "eval"] as ConceptId[]).map(id => [id, TODO]),
  ) as Record<ConceptId, string>,
  switches: [{ id: "example", label: "An example edge case" }],
  goals: [{ id: "goal", label: "The one goal" }],
  devices: [{ id: "thing", label: "A thing in the world" }],
  initState(s) { s.example = false; },
  initWorld(run) { run.setDevice("thing", "Idle"); },
  gauge2: S => ({ label: "Budget", text: `${S.rounds} rounds`, pct: S.rounds * 5, marker: 75 }),
  stats: [["Rounds", S => S.rounds], ["Retries", S => S.retries]],
  compactText: "Older rounds were summarized. Rules and memory stay pinned.",
  overflowText: "The naive harness silently dropped the oldest messages.",
  overflowIncident: "Context overflow dropped rules and memory",
  reportTitle: "Final answer → you",
  reportIntroH: "Here's what happened:",
  reportIntroN: "All done!",

  beats(run: Run) {
    const S = run.S;
    const { mround, hcard, setV, setGoal, setDevice, hit, wait } = run;

    async function bExample() {
      setGoal("goal", "active");
      const c = mround("do_the_thing", { how: "carefully" }, ["schema"]);
      await wait(500);
      if (S.sw.example && S.H) {
        hcard("Schema validation", "Caught a bad argument before it reached the device.", "warn", ["schema"]);
        hit("schema");
      } else if (S.sw.example) {
        hcard("No validation", "The bad argument went straight through.", "danger", ["schema"]);
        hit("schema", "miss");
      }
      setV(c, "success", "Done.");
      setDevice("thing", "Done", "good");
      setGoal("goal", "done");
    }

    return [bExample];
  },

  finalizeGoals() {},
  reportLines(S) {
    const L: ReportLine[] = [["ok", "The thing is done."]];
    S.caveats.forEach((t: string) => L.push(["caveat", t]));
    return L;
  },
  extraMetrics: () => [],
  extraResult: () => ({}),
  compareRows: [],
};
