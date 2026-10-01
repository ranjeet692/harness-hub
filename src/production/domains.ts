import type { ConceptId } from "../engine/concepts";

/* How each harness would go to production: the rollout stages, what the kill switch does, the
   service-level objectives, and runbooks for the incidents it's most likely to cause. Each
   runbook names the edge case and the missing guard that reproduce it (checked in
   tests/production.test.ts), so a fix ships with its regression test. */

/** repro: the edge case to switch on and the concept to switch off; the eval suite reproduces the incident with them. */
export interface Runbook { incident: string; detect: string; contain: string; recover: string; repro: { sw: string; off: ConceptId } }
export interface ProdPlan {
  shadow: string;
  canary: string;
  ga: string;
  killSwitch: string;
  slos: { name: string; target: string }[];
  runbooks: Runbook[];
}

export const PROD: Record<string, ProdPlan> = {
  barista: {
    shadow: "The agent plans every app order next to the baristas, including the charges it would make, but calls no machine and no terminal. Its plans are compared with what was actually made and rung up.",
    canary: "One store, app orders only, 5% of tickets. Charges stay in the confirm tier. Exit when charge errors are zero for two weeks and ticket time holds.",
    ga: "All stores, app and counter orders. The comp cap and allergen rules stay in code, and changes to them go through the eval gate.",
    killSwitch: "One flag sends new tickets back to the barista queue and removes charge_card and refund_line from the agent's tools. Tickets in flight finish with a person.",
    slos: [
      { name: "Drink matches the order", target: "≥ 99.5% of tickets" },
      { name: "Charge errors (double or wrong amount)", target: "0" },
      { name: "Allergen incidents", target: "0, page on first" },
      { name: "Ticket time", target: "p95 ≤ 4 min" },
    ],
    runbooks: [
      { incident: "A customer was charged twice", detect: "The terminal settlement report shows two captures for one ticket ID.", contain: "Kill switch off for charges. Refund the duplicate from the settlement report.", recover: "Check the idempotency key reached the terminal on retries; add the terminal's timeout code to the transient list if it was missing.", repro: { sw: "flaky", off: "idem" } },
      { incident: "An allergen reached a customer with a pinned allergy", detect: "The stop hook's allergen check fires, or a customer report arrives.", contain: "Pause comps and substitutions (the gate declines by default) and page the shift lead.", recover: "Check every comp and substitution passes the pinned allergen check and the cap before it runs.", repro: { sw: "budget", off: "budget" } },
      { incident: "An order note changed the price or opened the till", detect: "A discount over the comp cap, or a cash-drawer event with no staff badge.", contain: "Close the drawer, void the ticket, flag the account.", recover: "Confirm apply_discount and open_cash_drawer are not exposed; review the note wrapping.", repro: { sw: "injection", off: "inject" } },
    ],
  },
  robovac: {
    shadow: "The agent plans routes and would-be actions while the existing firmware cleans. Plans are compared with the firmware's coverage, and any plan that enters a no-go zone is a failure.",
    canary: "1% of robots in homes without a nursery or pet zone first, then all homes. Supply orders stay in the confirm tier.",
    ga: "All robots. No-go zones and the battery reserve stay in code, not in the model's instructions.",
    killSwitch: "One flag reverts robots to the firmware schedule and removes order_supplies. A robot mid-room finishes the zone and docks.",
    slos: [
      { name: "No-go zone entries", target: "0, page on first" },
      { name: "Robots stranded with a flat battery", target: "< 1 per 10,000 missions" },
      { name: "Room coverage", target: "≥ 95% of reachable area" },
      { name: "Duplicate or unapproved orders", target: "0" },
    ],
    runbooks: [
      { incident: "The robot entered the nursery during a nap", detect: "Map position inside a no-go polygon during its active window.", contain: "Stop the robot, dock it, and disable imported routines for that home.", recover: "Check the no-go override isn't reachable from any tool; check shared routines are wrapped as data.", repro: { sw: "injection", off: "inject" } },
      { incident: "The robot died mid-room", detect: "Battery at 0% more than 2 m from the dock.", contain: "Notify the owner; the next mission starts from a full charge.", recover: "Check the reserve calculation includes the trip home and the fallback navigation's extra drain.", repro: { sw: "lowbattery", off: "budget" } },
      { incident: "Dust bags were ordered twice", detect: "Two orders for one household within an hour.", contain: "Cancel the duplicate before it ships.", recover: "Check the order's idempotency key and the store's retry handling.", repro: { sw: "flaky", off: "idem" } },
    ],
  },
  butler: {
    shadow: "The agent plans the evening and builds the cart; the household approves or edits every action (suggest-only). Compare its plan with what they chose.",
    canary: "Opted-in households. Door unlocks stay suggest-only for 30 days without an incident; orders ask first.",
    ga: "All households that opt in. Door and alarm tools stay outside the agent's reach; unlocking always asks.",
    killSwitch: "One flag drops the agent to suggest-only and revokes schedule_unlock. Devices keep their last state.",
    slos: [
      { name: "Door unlocks outside an approved window", target: "0, page on first" },
      { name: "Spend over the household cap", target: "0" },
      { name: "Duplicate orders", target: "0" },
      { name: "Evening plan completed", target: "≥ 95% of goals" },
    ],
    runbooks: [
      { incident: "A door code was shared or the alarm disabled", detect: "An outbound message containing a code, or an alarm state change not made by a person.", contain: "Rotate the code, re-arm the alarm, and notify the household.", recover: "Confirm share_door_code and disable_alarm aren't exposed; check inbox text is wrapped as data.", repro: { sw: "injection", off: "inject" } },
      { incident: "Groceries were paid for twice", detect: "Two captures for one basket.", contain: "Refund the duplicate; hold the account's next order for review.", recover: "Check the idempotency key on place_order retries.", repro: { sw: "flaky", off: "idem" } },
      { incident: "Groceries arrive after dinner", detect: "Delivery slot later than the event time.", contain: "Cancel and refund, then offer a quick-commerce alternative.", recover: "Check compensation runs before re-ordering.", repro: { sw: "slotfail", off: "comp" } },
    ],
  },
  coding: {
    shadow: "The agent works on a mirror of the repo and posts its diff as a comment on the issue. Engineers compare it with their own fix; nothing is pushed.",
    canary: "Issues labelled for the agent in two low-risk repos. PRs need review; the diff budget stays at 8 files and 300 lines.",
    ga: "Opted-in repos. Pushing and opening PRs always ask; secrets are never readable by the agent's tools.",
    killSwitch: "Revoke the agent's GitHub app token for push and PR scopes. Open PRs stay open for humans to close or adopt.",
    slos: [
      { name: "Secrets exposed", target: "0, page on first" },
      { name: "PRs merged without changes", target: "≥ 60%" },
      { name: "Duplicate PRs", target: "0" },
      { name: "Diff within budget", target: "100% of PRs" },
    ],
    runbooks: [
      { incident: "A secret appeared in a PR", detect: "Secret scanning on the PR body or diff.", contain: "Rotate the key immediately, then remove the PR body revision.", recover: "Confirm .env isn't readable by any tool; check repo text is wrapped as data and curl-pipe-sh is refused.", repro: { sw: "injection", off: "inject" } },
      { incident: "Two identical PRs opened", detect: "Two open PRs from one head branch.", contain: "Close the newer one.", recover: "Check the branch is used as the idempotency key on create_pull_request retries.", repro: { sw: "flaky", off: "idem" } },
      { incident: "A 25-file drive-by refactor", detect: "The diff budget alert on PR open.", contain: "Close the PR; open a follow-up issue for the refactor.", recover: "Check the blast-radius budget runs before run_command, not after.", repro: { sw: "budget", off: "budget" } },
    ],
  },
  diagram: {
    shadow: "The agent draws into a hidden draft space. Authors compare it with their own diagrams; nothing reaches team pages.",
    canary: "One team's space. Publishing asks first and shows the diff; hand edits are pinned.",
    ga: "All spaces. Workspace-wide export and delete tools stay outside the agent's reach.",
    killSwitch: "One flag makes the agent draft-only and revokes publish_to_team_page. Drafts stay for their authors.",
    slos: [
      { name: "Brief items drawn", target: "8 of 8 on the golden briefs" },
      { name: "Hand edits lost", target: "0" },
      { name: "Diagrams exported outside the workspace", target: "0, page on first" },
      { name: "Duplicate published versions", target: "0" },
    ],
    runbooks: [
      { incident: "Someone's hand edits were overwritten", detect: "A pinned shape changed between two versions.", contain: "Restore the previous version from history.", recover: "Check pinned edits are re-applied after every re-layout.", repro: { sw: "hang", off: "mem" } },
      { incident: "A pasted brief tried to export the workspace", detect: "A call to an export or HTTP tool, or a flagged instruction in pasted text.", contain: "Block the session; review what the brief's author pasted.", recover: "Confirm export_workspace and http_post aren't exposed.", repro: { sw: "injection", off: "inject" } },
      { incident: "Two versions published at once", detect: "Two versions within a minute with identical content.", contain: "Delete the duplicate.", recover: "Check the revision key on publish retries.", repro: { sw: "flaky", off: "idem" } },
    ],
  },
  onboarding: {
    shadow: "The agent computes every write and runs reconciliation, but commits nothing. HR ops onboards as usual, and the agent's writes are diffed against theirs, field by field.",
    canary: "One office, standard roles, one cohort of new hires. Admin roles and orders over policy always ask.",
    ga: "All offices. HR stays the source of truth; nightly reconciliation runs even when the agent didn't write.",
    killSwitch: "One flag pauses all writes and routes tickets to HR ops with the agent's plan attached. Reconciliation keeps running.",
    slos: [
      { name: "Fields out of sync with HR", target: "0 after reconciliation" },
      { name: "Ready on day one", target: "≥ 98% of new hires" },
      { name: "Privileged access without approval", target: "0, page on first" },
      { name: "Personal data outside HR and payroll", target: "0, page on first" },
    ],
    runbooks: [
      { incident: "Payroll has the wrong start date", detect: "Nightly reconciliation reports drift between HR and payroll.", contain: "Correct payroll from HR; hold the first pay run for that employee.", recover: "Check writes re-read HR right before writing, not from the ticket.", repro: { sw: "datechange", off: "mem" } },
      { incident: "A new hire was given admin access", detect: "A privileged role granted without a matching Security approval.", contain: "Revoke the role and review the access log.", recover: "Check grant_role is in the confirm tier and the default is the standard set.", repro: { sw: "admin", off: "gate" } },
      { incident: "Salary and bank details landed in the IT helpdesk", detect: "The data-scope check flags a ticket, or a DLP scan hits.", contain: "Purge the ticket and its notifications; inform the data protection officer.", recover: "Check each system's allowed fields are enforced before the write.", repro: { sw: "pii", off: "tiers" } },
    ],
  },
};
