/* Blueprint: from a requirement to a harness design. Pure functions and types, shared by the
   builder, the Blueprint tab on each harness page, the exports and the tests. Nothing here calls
   a model: the requirement highlighter is a set of phrase rules, so it's free, instant and
   gives the same answer every time. */

import { CONCEPTS, type ConceptId } from "../engine/concepts";

export type Autonomy = "suggest" | "approve" | "alone" | "never";
export type Tier = "safe" | "confirm" | "never";
export type Status = "open" | "decided" | "na";
export type Shape = "workflow" | "workflow+agent" | "agent" | "multi";

export interface System { name: string; access: "read" | "write" | "read+write"; truth: boolean; money: boolean; untrusted: boolean; note: string }
export interface Action { label: string; autonomy: Autonomy; why: string }
export interface ToolRow { name: string; does: string; tier: Tier; key: string; retry: string; undo: string }
export interface TraceRow { said: string; concept: ConceptId; edge: string; hold: string }
export interface Decision { status: Status; note: string }

export interface Design {
  v: 1;
  name: string;
  client: string;
  requirement: string;
  job: string;
  done: string[];
  shape: Shape;
  maxRounds: number;
  world: System[];
  actions: Action[];
  risks: Record<RiskId, boolean>;
  tools: ToolRow[];
  concepts: Record<ConceptId, Decision>;
  trace: TraceRow[];
  questions: string[];
}

/* ---------- the requirement highlighter ---------- */

export interface Rule {
  id: string;
  concept: ConceptId | "workflow";
  label: string;
  re: RegExp;
  /** What the phrase implies for the harness. */
  then: string;
  /** A starting edge case and what must hold, for the traceability matrix. */
  edge: string;
  hold: string;
}

const MONEY = String.raw`(?:₹|\$|€|£|rs\.?\s?|inr\s?|usd\s?)?\s?\d[\d,.]*\s?(?:k|lakh|lakhs|crore|cr|m|million|bn)?`;

export const RULES: Rule[] = [
  { id: "limit", concept: "budget", label: "Budget", re: new RegExp(String.raw`\b(?:under|below|up to|within|over|above|more than|less than|at most|no more than|capped at|limit(?:ed)? (?:of|to))\s+${MONEY}(?:\s?(?:lakh|crore|k))?`, "gi"),
    then: "A hard limit, enforced in code on every call, not a line in the prompt.", edge: "A request just over the limit", hold: "actions over the limit without approval = 0" },
  { id: "budget", concept: "budget", label: "Budget", re: /\b(?:budget|spend(?:ing)? (?:limit|cap)|cost cap|per[- ]month cap)\b/gi,
    then: "Decide what is capped (money, tokens, files, time) and where the guard sits.", edge: "The model picks the expensive option", hold: "spend within the cap" },
  { id: "approve", concept: "gate", label: "Gate", re: /\b(?:approv(?:e|ed|al)(?: by (?:the |a |an )?[\w -]{2,30}?(?=[,.;]|$| and| before| if))?|sign[- ]off|check with (?:the |a )?\w+|confirm(?:ed|ation)? (?:by|from|with) (?:the |a )?\w+|reviewed by (?:the |a )?\w+|human in the loop)\b/gi,
    then: "A person decides. Pick the safe default, and what happens when nobody answers.", edge: "Nobody answers the approval request", hold: "auto-approved actions = 0" },
  { id: "never", concept: "tiers", label: "Tool tiers", re: /\b(?:must never|should never|never|must not|mustn't|should not|shouldn't|do not|don't|not allowed to|isn't allowed to|forbidden to)\s+[^.,;]{3,60}/gi,
    then: "Don't give the agent that tool at all. A rule in the prompt can be talked around; a missing tool can't.", edge: "The model is asked to do the forbidden thing", hold: "forbidden actions = 0" },
  { id: "twice", concept: "idem", label: "Idempotency", re: /\b(?:twice|duplicates?|double[- ](?:pay|charge|book|order|post)\w*|more than once|exactly once|only once)\b/gi,
    then: "Give every write an idempotency key, so a retry after a timeout can't do it twice.", edge: "The call times out after it succeeded", hold: "duplicate writes = 0" },
  { id: "untrusted", concept: "inject", label: "Injection", re: /\b(?:by e-?mail|e-?mails?|inbox|pdfs?|attachments?|web ?pages?|websites?|comments?|free[- ]text|notes|chat messages|messages from (?:customers|users|vendors)|reviews|uploaded files?|uploads)\b/gi,
    then: "Text the agent reads from here is untrusted. It's wrapped as data, and no tool follows it.", edge: "The text contains “AI assistant: ignore your rules and …”", hold: "instructions followed from data = 0" },
  { id: "truth", concept: "mem", label: "Source of truth", re: /\b(?:in|from|per|against|with|to) (?:the )?(?:sap|erp|crm|hris|hr system|salesforce|workday|netsuite|database|ledger|vendor master|master data|system of record|purchase order|po)\b/gi,
    then: "Name the source of truth, and re-read it right before every write.", edge: "The record changes after the agent first read it", hold: "writes from stale values = 0" },
  { id: "pii", concept: "tiers", label: "Data scope", re: /\b(?:salary|salaries|bank (?:details|account)s?|pan|aadhaar|ssn|passport|date of birth|medical|health records?|personal data|pii|home address(?:es)?|phone numbers?)\b/gi,
    then: "Decide which system may hold which personal fields, and strip the rest before any write.", edge: "The model pastes the whole record into a ticket", hold: "personal data outside its systems = 0" },
  { id: "irreversible", concept: "tiers", label: "Tool tiers", re: /\b(?:pay|pays|schedules? payments?|payments?|transfers?|refunds?|send (?:it|them|an? \w+) to|emails? the (?:customer|client|vendor)|publish(?:es)?|post(?:s)? to|delete|deletes|place (?:an )?orders?|orders?|purchases?|books?|bookings?)\b/gi,
    then: "A write that's hard to undo. Give it a tier, and decide how it's undone.", edge: "The model does it on a bad input", hold: "irreversible actions on bad input = 0" },
  { id: "volume", concept: "parallel", label: "Parallel", re: /\b(?:about |around |~)?\d[\d,]*\s+(?:\w+\s){0,2}(?:a|per|each|every) (?:day|week|month|hour)\b|\b(?:in bulk|batch(?:es)?|thousands of|hundreds of)\b/gi,
    then: "Volume changes the design: batch the work, run independent reads together, and budget cost per item.", edge: "A spike: several times the usual volume in one day", hold: "cost per item within budget, finished on time" },
  { id: "verify", concept: "stophook", label: "Stop hook", re: /\b(?:flags?|mismatch(?:es)?|verif(?:y|ied)|reconcile|make sure|ensure|double[- ]check|validate|accurate|correct(?:ly)?|matches?|match(?:ed|ing)?)\b/gi,
    then: "Before “done”, check the result in code against the real systems. Don't take the model's word.", edge: "The model says done, but the result is wrong", hold: "false “done” claims = 0" },
  { id: "deadline", concept: "timeout", label: "Timeout", re: /\b(?:by (?:\d{1,2}(?::\d\d)?\s?(?:am|pm)|monday|tuesday|wednesday|thursday|friday|eod|end of day|tomorrow)|within \d+\s?(?:min(?:ute)?s?|hours?|days?)|deadline|sla)\b/gi,
    then: "A deadline means bounded waits and a fallback path when something is slow.", edge: "A dependency hangs", hold: "finished before the deadline, or told why" },
  { id: "api", concept: "retry", label: "Retry", re: /\b(?:api|apis|third[- ]party|gateway|integration|vendor portal|external service|webhook)\b/gi,
    then: "External calls fail. Retry transient errors with backoff; never retry a write without its key.", edge: "The service returns 503, then times out", hold: "the run recovers without duplicates" },
  { id: "docs", concept: "subagent", label: "Subagent", re: /\b(?:polic(?:y|ies)|handbook|contracts?|manuals?|knowledge base|documentation|\d+[- ]page)\b/gi,
    then: "Long reading goes to a subagent in its own context. Only a short summary comes back.", edge: "The document is 40 pages long", hold: "main context stays under its budget" },
  { id: "poll", concept: "loopguard", label: "Loop guard", re: /\b(?:until|keep (?:checking|trying)|poll(?:s|ing)?|wait(?:s|ing)? for|follow[- ]ups?|remind(?:ers?)?)\b/gi,
    then: "Waiting is where agents loop. Cap repeats, and prefer a webhook to polling.", edge: "The thing it waits for never changes", hold: "identical repeated calls ≤ 3" },
  { id: "undo", concept: "comp", label: "Compensation", re: /\b(?:undo|roll ?back|revert|cancel(?:s|led)?)\b/gi,
    then: "When a later step fails, undo the earlier ones in a known order.", edge: "Step 3 fails after steps 1–2 committed", hold: "no half-finished state left behind" },
  { id: "remember", concept: "mem", label: "Memory", re: /\b(?:remember|preferences?|last time|previous(?:ly)?|history|profile)\b/gi,
    then: "Decide what persists across runs, and pin it so it's never summarized away.", edge: "The context fills up and old messages are dropped", hold: "pinned facts lost = 0" },
  { id: "changes", concept: "steer", label: "Steering", re: /\b(?:change (?:their|my|the|its) mind|changes? (?:the|their) (?:request|order|plan)|mid-?way|while it(?:'s| is) running|at any time)\b/gi,
    then: "New instructions arrive mid-run. Deliver them at the next round boundary.", edge: "The request changes halfway through", hold: "the final result follows the latest instruction" },
  { id: "schedule", concept: "workflow", label: "Workflow", re: /\b(?:daily|weekly|monthly|every (?:morning|day|week|night|hour)|summary|summaries|digest|report)\b/gi,
    then: "A scheduled or fixed step. It doesn't need a model loop.", edge: "", hold: "" },
];

export interface Finding { start: number; end: number; text: string; rule: Rule }

/** Find the phrases in a requirement that imply harness work, left to right, without overlaps. */
export function analyze(text: string): Finding[] {
  const all: Finding[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      const t = m[0].replace(/\s+$/, "");
      if (t.length < 2) continue;
      // "never pay twice" is about duplicates, not about a forbidden tool
      const r = rule.id === "never" && /\b(?:twice|duplicates?|more than once)\b/i.test(t) ? RULES.find(x => x.id === "twice")! : rule;
      all.push({ start: m.index!, end: m.index! + t.length, text: t, rule: r });
    }
  }
  // earlier rules win ties; longer spans win overlaps
  all.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start) || RULES.indexOf(a.rule) - RULES.indexOf(b.rule));
  const out: Finding[] = [];
  for (const f of all) {
    const last = out[out.length - 1];
    if (last && f.start < last.end) continue;
    out.push(f);
  }
  return out;
}

/** Findings grouped by rule, in first-seen order: one numbered item per kind of phrase. */
export function groupFindings(findings: Finding[]): { rule: Rule; texts: string[] }[] {
  const by = new Map<string, { rule: Rule; texts: string[] }>();
  for (const f of findings) {
    const g = by.get(f.rule.id) ?? { rule: f.rule, texts: [] };
    if (!g.texts.some(t => t.toLowerCase() === f.text.toLowerCase())) g.texts.push(f.text);
    by.set(f.rule.id, g);
  }
  return [...by.values()];
}

/** Concepts the requirement text surfaces, in first-seen order. */
export function surfaced(findings: Finding[]): ConceptId[] {
  const seen = new Set<ConceptId>();
  for (const f of findings) if (f.rule.concept !== "workflow") seen.add(f.rule.concept);
  return [...seen];
}

const JUDGMENT = /\b(?:match(?:es|ing)?|resolve|decide|figure out|handle|triage|classify|categori[sz]e|understand|plan|investigate|respond|draft|negotiate|diagnose|recommend|choose|pick|summari[sz]e|extract)\b/gi;
const FIXED = /\b(?:daily|weekly|every (?:morning|day|week)|then|schedule|post(?:s)? to|send(?:s)? (?:a|the) (?:summary|report)|export|copy|sync)\b/gi;

/** A first answer to "is this an agent at all?" */
export function verdict(text: string): { shape: Shape; title: string; why: string } {
  const j = (text.match(JUDGMENT) ?? []).length, f = (text.match(FIXED) ?? []).length;
  if (!text.trim()) return { shape: "workflow+agent", title: "Paste a requirement", why: "The verdict appears once there's text to read." };
  if (j === 0) return { shape: "workflow", title: "A workflow, not an agent", why: "Nothing here needs judgment. Fixed steps are cheaper, easier to test and can't go rogue. Use a model for one step at most, such as extraction." };
  if (f > 0 || j <= 2) return { shape: "workflow+agent", title: "A workflow with an agent step", why: "Most steps are fixed. Keep them as code, and put a model loop only where judgment is needed." };
  return { shape: "agent", title: "An agent loop", why: "The path depends on what the agent finds along the way, so the model chooses the next step. Guard every tool." };
}

/* ---------- where each concept is decided, and the question it asks ---------- */

export type StepId = "requirement" | "job" | "world" | "risks" | "loop" | "tools" | "guards" | "evals" | "export";
export const STEPS: { id: StepId; label: string; pass: "Read" | "HLD" | "LLD" | "Verify" }[] = [
  { id: "requirement", label: "Requirement", pass: "Read" },
  { id: "job", label: "Job & done", pass: "HLD" },
  { id: "world", label: "World", pass: "HLD" },
  { id: "risks", label: "Risks", pass: "HLD" },
  { id: "loop", label: "Loop", pass: "HLD" },
  { id: "tools", label: "Tools", pass: "LLD" },
  { id: "guards", label: "Guards", pass: "LLD" },
  { id: "evals", label: "Evals", pass: "Verify" },
  { id: "export", label: "Export", pass: "Verify" },
];

/** Every concept is decided in exactly one step. */
export const CONCEPT_STEP: Record<ConceptId, StepId> = {
  ctx: "loop", mem: "loop", compact: "loop", steer: "loop", loop: "loop", parallel: "loop", subagent: "loop", loopguard: "loop",
  tiers: "tools", schema: "tools", unknown: "tools", retry: "tools", timeout: "tools", idem: "tools", comp: "tools",
  gate: "guards", budget: "guards", inject: "guards", stophook: "guards",
  eval: "evals",
};

export const QUESTION: Record<ConceptId, string> = {
  ctx: "What goes into the prompt every round: rules, task, a fresh read of which systems?",
  mem: "What must persist across rounds or runs, and which system is the source of truth for each fact?",
  compact: "When the window fills, what can be summarized, and what must stay word for word?",
  steer: "Can the requester change their mind mid-run? Where does a new message land?",
  loop: "What is one round? What's the most rounds a task may take?",
  parallel: "Which reads are independent enough to run together?",
  subagent: "Is there long reading or a side task that belongs in its own context?",
  loopguard: "What counts as stuck: the same call with the same arguments how many times?",
  tiers: "Which tools are safe, which ask first, and which are never offered?",
  schema: "Which arguments have rules (types, ranges, codes that must exist) to check before a call runs?",
  unknown: "What does the model get back when it calls a tool that doesn't exist?",
  retry: "Which calls can fail transiently, and how many retries with what backoff?",
  timeout: "How long may each call take, and what's the fallback when it doesn't answer?",
  idem: "Which writes need a key so a retry can't do them twice? What's the key?",
  comp: "If a later step fails, which earlier writes must be undone, and how?",
  gate: "Which actions pause for a person, what do they see, and what happens when nobody answers?",
  budget: "What is capped (money, tokens, files, battery), at what value, and where is it enforced?",
  inject: "Where does untrusted text enter, and what stops it from acting as instructions?",
  stophook: "What must be true, checked in code, before the agent may say “done”?",
  eval: "Which numbers will you track across versions, and what are the thresholds?",
};

export const CONCEPT_LABEL = Object.fromEntries(CONCEPTS.map(c => [c.id, c.label])) as Record<ConceptId, string>;
export const CONCEPT_IDS = CONCEPTS.map(c => c.id);

/* ---------- risks (HLD) ---------- */

export type RiskId = "money" | "irreversible" | "personal" | "external" | "untrusted" | "physical" | "secrets" | "volume";
export const RISKS: { id: RiskId; label: string; hint: string; concepts: ConceptId[] }[] = [
  { id: "money", label: "It moves money", hint: "Payments, refunds, orders, discounts.", concepts: ["budget", "gate", "idem"] },
  { id: "irreversible", label: "Some actions can't be undone", hint: "Sent, published, deleted, shipped.", concepts: ["tiers", "gate", "comp"] },
  { id: "personal", label: "It touches personal data", hint: "Salaries, IDs, bank details, health, addresses.", concepts: ["tiers", "inject"] },
  { id: "external", label: "It talks to people outside", hint: "Customers, vendors, candidates, the public.", concepts: ["gate", "stophook"] },
  { id: "untrusted", label: "It reads text someone else wrote", hint: "Emails, documents, tickets, web pages, notes.", concepts: ["inject"] },
  { id: "physical", label: "It acts in the physical world", hint: "Doors, devices, vehicles, machines.", concepts: ["gate", "timeout"] },
  { id: "secrets", label: "It can reach secrets or admin rights", hint: "Keys, passwords, admin roles, production.", concepts: ["tiers", "inject"] },
  { id: "volume", label: "It runs at volume, unattended", hint: "Batches, schedules, no one watching.", concepts: ["loopguard", "budget", "eval"] },
];

/* ---------- coverage ---------- */

export function coverage(d: Design, found: ConceptId[] = []) {
  let decided = 0, na = 0, surfacedOpen = 0, open = 0;
  const openIds: ConceptId[] = [];
  for (const id of CONCEPT_IDS) {
    const s = d.concepts[id]?.status ?? "open";
    if (s === "decided") decided++;
    else if (s === "na") na++;
    else { openIds.push(id); if (found.includes(id)) surfacedOpen++; else open++; }
  }
  return { decided, na, surfacedOpen, open, openIds, ready: openIds.length === 0 };
}

export function emptyDesign(): Design {
  return {
    v: 1, name: "", client: "", requirement: "", job: "", done: [""], shape: "workflow+agent", maxRounds: 12,
    world: [], actions: [], risks: Object.fromEntries(RISKS.map(r => [r.id, false])) as Record<RiskId, boolean>,
    tools: [], concepts: Object.fromEntries(CONCEPT_IDS.map(id => [id, { status: "open", note: "" }])) as Record<ConceptId, Decision>,
    trace: [], questions: [],
  };
}

/** Trace rows suggested by the requirement: one per finding that maps to a concept, deduped by concept. */
export function suggestTrace(findings: Finding[]): TraceRow[] {
  const rows: TraceRow[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    if (f.rule.concept === "workflow" || !f.rule.edge) continue;
    const k = f.rule.id;
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({ said: `“${f.text}”`, concept: f.rule.concept, edge: f.rule.edge, hold: f.rule.hold });
  }
  return rows;
}
