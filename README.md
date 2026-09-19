# harness-hub

**The model is the engine. The harness is the car.**

harness-hub rebuilds everyday systems as AI agent harnesses, so you can watch the parts of a harness at work: the context the model sees, the tools it can call, the loop that keeps it going, the guardrails that keep it safe, and the scorecard that tells you whether it worked. Every scenario runs through a **hardened** harness and a **naive** one, side by side, so you see exactly what each piece of harness engineering buys you.

| Domain | The scenario | Hardened vs naive, all edge cases on |
|---|---|---|
| **Barista** | One latte order: a flaky card terminal, a jammed grinder, a nut allergy, an order note that tries to empty the till | 5/5 goals, 0 incidents vs 0/5 goals, 4 incidents |
| **Robovac** | One cleaning mission: a shrinking battery, a silent lidar, the dog's accident, a routine that points at the nursery | 5/5 goals, 0 incidents vs 1/5 goals, 4 incidents |
| **Home Butler** | One evening of guests: money, a door lock, an offline thermostat, a hijack attempt in the inbox | 5/5 goals, 0 incidents vs 2/5 goals, 3 incidents |

## What's inside

- **Scripted runs** for all three domains. The model's choices are fixed, so every run is repeatable, and what varies is how the harness responds. Nine edge-case switches per domain, a board of 20 concepts that light up as they're exercised, live world state, gauges, and a hardened-vs-naive comparison table.
- **Live model mode** (barista first). A real Claude model makes every decision through a real harness running in your browser. It enforces tool tiers, schema validation, unknown-tool errors, a loop guard, budget and allergen guards, confirmation gates, retries with backoff, idempotency keys, untrusted-data wrapping, compaction, mid-run steering and a stop hook, all in code, against a simulated coffee bar with injectable faults. Bring your own Anthropic API key. It's sent only to `api.anthropic.com`, straight from your browser.
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
    _template/   start here to add a domain
  live/          the real-model harness, Anthropic client, schema validator, live console
  components/    console, trace cards, concept board, comparison table
  pages/         home, domain, concepts, contribute
tests/           headless tests across every domain and switch, plus a scripted-model live test
```

Vite, React 19 and TypeScript, with no runtime dependencies beyond React. It's a static site with hash routing, so it deploys to GitHub Pages or any static host as is. The included GitHub Actions workflow runs the tests, builds, and deploys to Pages on every push to `main`.

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
