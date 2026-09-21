import { href } from "../router";

const DOMAIN_SKETCH = `// src/domains/pharmacy/index.ts
import type { Domain } from "../../engine/types";
import type { Run } from "../../engine/run";

export const pharmacy: Domain = {
  id: "pharmacy",
  number: "05",
  title: "The Pharmacy Harness",
  // ...copy, switches, goals, devices, gauges, report...

  beats(run: Run) {
    const S = run.S;
    const { mround, hcard, setV, hit, wait } = run;

    async function bDispense() {
      const c = mround("dispense", { drug: "amoxicillin", mg: 500 }, ["gate"]);
      await wait(500);
      if (S.H) {
        hcard("Confirmation gate", "Prescription drugs need a pharmacist's OK.", "info", ["gate"]);
        hit("gate");
      } else {
        setV(c, "danger", "Dispensed without a check.");
        hit("gate", "miss");
      }
    }

    return [bDispense /* , ...more beats */];
  },
};`;

export function Contribute() {
  return (
    <div className="wrap narrow">
      <article className="prose">
        <p className="eyebrow">Contribute</p>
        <h1>Add the next harness</h1>
        <p className="dek" style={{ fontSize: 18 }}>
          Every domain on the hub runs on one shared engine. A new domain is a single TypeScript module. You describe the world, the edge cases and how each harness responds, and you get the console, the concept board, the scorecard and the tests for free.
        </p>

        <h2>How the pieces fit</h2>
        <ul>
          <li><code>src/engine/</code> holds the run loop, the trace-card model, compaction, decisions and scoring. It has no UI code, so it runs headless in tests.</li>
          <li><code>src/domains/&lt;id&gt;/</code> holds one domain: its copy, its edge-case switches, its goals, its world state, and its <em>beats</em>, the steps of the scenario.</li>
          <li><code>src/live/</code> holds the real-model harness: tiers, validation, guards, gates, retries, idempotency, compaction, steering and the stop hook, around the Anthropic Messages API.</li>
          <li><code>src/concepts</code> content lives in <code>src/engine/concepts.ts</code>. Every domain writes one sentence per concept explaining how it shows up there.</li>
        </ul>

        <h2>Steps</h2>
        <ol>
          <li>Copy <code>src/domains/_template/</code> to <code>src/domains/&lt;your-id&gt;/</code>.</li>
          <li>Pick a scenario where things naturally go wrong: money, physical access, flaky devices, untrusted text, plans that change mid-run.</li>
          <li>Write nine edge-case switches, and make sure every one of the 20 concepts gets exercised by at least one beat.</li>
          <li>For each beat, write both branches. <code>S.H</code> is the hardened harness and calls <code>hit(id)</code>. The naive branch shows the realistic failure and calls <code>hit(id, "miss")</code>.</li>
          <li>Register the domain in <code>src/domains/index.ts</code>.</li>
          <li>Run <code>npm test</code>. The shared tests check that every domain handles all 20 concepts when hardened, misses 16 when naive, and finishes cleanly for every single edge case and for declined decisions.</li>
        </ol>

        <h2>A beat, in miniature</h2>
        <pre><code>{DOMAIN_SKETCH}</code></pre>

        <h2>Adding live-model mode</h2>
        <p>
          Give the domain a <code>live</code> spec (see <code>src/domains/barista/live.ts</code>, or <code>src/domains/coding/live.ts</code> for one where the model's code actually runs): the tools with their tiers and JSON schemas, a simulator that executes them and injects faults, pre-execution guards, confirmation text, and a <code>verify</code> function the stop hook and scorecard use. The harness in <code>src/live/harness.ts</code> does the rest.
        </p>

        <h2>Ground rules</h2>
        <ul>
          <li>Scripted runs must be repeatable: no randomness that changes the outcome.</li>
          <li>Write copy from the user's side: what they'd see, not how it's built.</li>
          <li>Keep safety incidents at zero in hardened mode. That's what the tests enforce.</li>
        </ul>

        <p><a href={href("/concepts")}>Browse the 20 concepts →</a></p>
      </article>
    </div>
  );
}
