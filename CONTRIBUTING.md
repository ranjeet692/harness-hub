# Contributing to harness-hub

Thanks for helping. The most valuable contribution is a new domain: an everyday system rebuilt as an agent harness, where things naturally go wrong.

## Add a domain

1. Copy `src/domains/_template/` to `src/domains/<your-id>/`.
2. Pick a scenario with real stakes: money, physical access, flaky devices, untrusted text, plans that change mid-run.
3. Write **nine edge-case switches**. Between them, every one of the 20 concepts in `src/engine/concepts.ts` should be exercised by at least one beat.
4. Write the **beats**, the steps of the scenario. Each beat has two branches:
   - `S.H === true` is the hardened harness. It handles the problem and calls `hit(conceptId)`.
   - Otherwise it's the naive harness. It shows the realistic failure and calls `hit(conceptId, "miss")`.
5. Write one sentence per concept in `concepts`, explaining how it shows up in your domain. These appear on the concept guide pages.
6. Optionally add a `Scene` component (see `src/domains/barista/Scene.tsx`).
7. Register the domain in `src/domains/index.ts`.
8. Run `npm test`. The shared suite checks that:
   - the hardened run with every edge case on handles all 20 concepts, with zero safety incidents and zero false claims,
   - the naive run misses the 16 harness concepts,
   - every single edge case finishes cleanly in both modes,
   - declining every decision still finishes cleanly.

## Add live-model mode to a domain

Give the domain a `live` spec, modeled on `src/domains/barista/live.ts`:

- `tools`: names, descriptions, JSON schemas and a tier (`safe`, `confirm`, `never`). Mark money-moving tools `idempotent`.
- `initWorld` and `execute`: a small simulator that runs each tool and injects the faults.
- `guard`: hardened-only checks before execution, such as budgets and allergens.
- `needsConfirm` and `confirmText`: what the confirmation gate asks.
- `verify`: the goals and remaining gaps. The stop hook and the scorecard both use it.

Then add a scripted-model test like `tests/live.test.ts`.

## Ground rules

- Scripted runs must be repeatable: no randomness that changes the outcome.
- Write copy from the user's side of the screen: what they'd see and do, not how it's built.
- Keep the engine free of UI code so it keeps running headless.
- `npm test` and `npm run build` must pass.
