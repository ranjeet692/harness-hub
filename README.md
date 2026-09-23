# harness-hub

**The model is the engine. The harness is the car.**

harness-hub rebuilds everyday systems as AI agent harnesses, so you can watch the parts of a harness at work: the context the model sees, the tools it can call, the loop that keeps it going, the guardrails that keep it safe, and the scorecard that tells you whether it worked. Every scenario runs through a **hardened** harness and a **naive** one, side by side, so you see exactly what each piece of harness engineering buys you.

| Domain | The scenario | Hardened vs naive, all edge cases on |
|---|---|---|
| **Barista** | One latte order: a flaky card terminal, a jammed grinder, a nut allergy, an order note that tries to empty the till | 5/5 goals, 0 incidents vs 0/5 goals, 4 incidents |
| **Robovac** | One cleaning mission: a shrinking battery, a silent lidar, the dog's accident, a routine that points at the nursery | 5/5 goals, 0 incidents vs 1/5 goals, 4 incidents |
| **Home Butler** | One evening of guests: money, a door lock, an offline thermostat, a hijack attempt in the inbox | 5/5 goals, 0 incidents vs 2/5 goals, 3 incidents |
| **Coding agent** | One GitHub issue: an edit that matches three places, a suite that hangs on Postgres, a CI polling loop, a dead-end dependency, a code comment telling AI agents to curl a script and paste `.env` | 5/5 goals, 0 incidents vs 0.5/5 goals, 2 incidents, 3,806-line diff, 2 duplicate PRs |
| **Diagram agent** | One process brief turned into a flowchart you can also edit by hand: a brief that names a step it never defines, a layout engine that hangs, your two hand edits, a drive-by restyle, a hidden instruction in pasted wiki text, a switch to a sequence diagram mid-run | 5/5 goals, 0 incidents, 8/8 brief items, 0 warnings vs 0/5 goals, 2 incidents, 6/8 items, 6 warnings, 2 versions published |
| **Onboarding agent** | One new hire across seven systems, with HR as the source of truth: a start date moved after the ticket, a renamed cost centre, a new manager mid-run, a returning contractor, a laptop vendor that times out, a request for admin access, salary details heading for the IT helpdesk, a hidden instruction in recruiter notes | 5/5 goals, 0 incidents, 0 fields out of sync, ₹1.49L spent vs 0/5 goals, 3 incidents, 6 fields out of sync, ₹6.8L on two laptops, 2 data leaks |

## What's inside

- **Scripted runs** for all six domains. The model's choices are fixed, so every run is repeatable, and what varies is how the harness responds. Nine edge-case switches per domain, a board of 20 concepts that light up as they're exercised, live world state, gauges, and a hardened-vs-naive comparison table.
- **Live model mode** for the barista and the coding agent. A real Claude model makes every decision through a real harness running in your browser. It enforces tool tiers, schema validation, unknown-tool errors, a loop guard, budget and allergen guards, confirmation gates, retries with backoff, idempotency keys, untrusted-data wrapping, compaction, mid-run steering and a stop hook, all in code. Bring your own Anthropic API key. It's sent only to `api.anthropic.com`, straight from your browser.
  - **Coding agent, live:** the model works on a small JavaScript checkout repo (`pricing.js`, `cart.js`, tests, `AGENTS.md`, a generated file and a fake `.env`). `edit_file` is exact string replacement that must match once, like the edit tools in real coding agents. The model's code **really runs**: the unit tests execute in a sandboxed Web Worker with a 2-second limit, so "tests pass" means the model's actual fix passes. This is the easiest way to check the harness claims against your own experience with coding agents.
- **An animated loop on every harness page.** Above the timeline, the run is drawn as a track: context, decide, check, act, observe, "stuck?" and "done?", around the model. A bright head moves to the station of the latest step, so every model round is a lap; it turns red when something goes wrong and purple when the run is waiting for you. Each station counts what the harness handled and missed there. The timeline stays the detailed view.
- **A page built for first-time visitors.** Every harness page follows the same four numbered steps: set up the run, watch it, see what the harness handled, compare. A bar pinned under the navigation always says what the run is doing right now, and when a step needs a person (a payment, a door lock, a pull request) the run pauses and the question slides up from the bottom of the screen instead of hiding in the timeline.
- **A diagram canvas for the diagram agent.** Shapes and arrows appear as the agent draws them, next to the checks verification runs: which of the eight brief items are on the canvas, the graph rules (one start, an end, labelled branches, no arrow into nothing, nothing unreachable or overlapping), an export-to-Mermaid-and-parse-back round trip, and whether your hand edits survived. The checks are real functions in `src/domains/diagram/model.ts`, with their own tests.
- **A system map for the onboarding agent.** The HR record sits in the middle as the source of truth, with the week-old ticket beside it and every downstream system around it: payroll, finance, identity, procurement, facilities and the IT helpdesk. Each field is marked as it's written, so you see a stale start date or a second identity the moment it lands. Reconciliation (`reconcile` and `policyFindings` in `src/domains/onboarding/model.ts`) is real code with its own tests.
- **A real-looking code editor for the coding agent.** Explorer with git decorations, a diff gutter against main, the agent's terminal and a status bar, all following the run. In live mode it shows the real files the model edits.
- **Concept guides** for all 20 concepts: why each one matters, what breaks without it, how to build it, a code sketch, and links into each domain's trace.

### The 20 concepts

| Context | Tools | Loop control | Safety | Evaluation |
|---|---|---|---|---|
| Context assembly | Agent loop | Retry + backoff | Confirmation gates | Scorecard |
| Memory | Tool tiers | Timeout + fallback | Budget guard | |
| Compaction | Parallel calls | Idempotency | Injection defense | |
| Mid-run steering | Schema validation | Loop guard | Compensation | |
| | Unknown tool | Stop hook | | |
| | Subagents | | | |

## Run it locally

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # engine, domains and live-harness tests
npm run build     # static site in dist/
```

Node 20 or newer.

## How it's built

```
src/
  engine/        run loop, trace-card model, compaction, decisions, scoring, the 20 concepts (no UI code)
  domains/       one folder per domain: copy, switches, goals, world, beats, scene
    coding/      live.ts (mini repo + simulator) and runner.ts (sandboxed test runner)
    _template/   start here to add a domain
  live/          the real-model harness, Anthropic client, schema validator, live console
  components/    console, trace cards, concept board, comparison table
  pages/         home, domain, concepts, contribute
tests/           headless tests across every domain and switch, plus a scripted-model live test
```

Vite, React 19 and TypeScript, with no runtime dependencies beyond React. Fonts (Instrument Serif, Geist, Geist Mono) are self-hosted through Fontsource, so the site makes no third-party requests. It's a static site with hash routing, so it deploys to GitHub Pages or any static host as is. The included GitHub Actions workflow runs the tests, builds, and deploys to Pages on every push to `main`.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow tests, builds and publishes to `https://<you>.github.io/harness-hub/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: a new domain is one TypeScript module, and the shared tests check that your hardened harness handles all 20 concepts with zero safety incidents.

## Credit

The framing comes from the VS Code team's post [The Coding Harness Behind GitHub Copilot in VS Code](https://code.visualstudio.com/blogs/2026/05/15/agent-harnesses-github-copilot-vscode).

## License

MIT
