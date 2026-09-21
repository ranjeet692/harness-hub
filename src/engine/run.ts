import { CONCEPT_BY_ID, type ConceptId } from "./concepts";
import { inline, k } from "./format";
import type {
  Actor, Block, Card, Domain, GoalStatus, Mode, RunResult, RunState, Tone, VerdictClass,
} from "./types";

export interface RunOptions {
  mode: Mode;
  sw: Record<string, boolean>;
  instant?: boolean;
  fast?: boolean;
}

class Aborted extends Error {}

/**
 * One scripted run of a domain. The run owns all state; beats mutate it through the
 * helper methods below, and every mutation calls emit() so a UI can re-render.
 * The engine has no DOM dependency, so it also runs headless in tests.
 */
export class Run {
  readonly domain: Domain;
  S: RunState;
  cards: Card[] = [];
  version = 0;
  done = false;
  result: RunResult | null = null;
  private listeners = new Set<() => void>();
  private nextId = 1;
  private aborted = false;
  private pending: { cardId: number; resolve: (id: string) => void } | null = null;

  constructor(domain: Domain, opts: RunOptions) {
    this.domain = domain;
    const S: RunState = {
      mode: opts.mode, H: opts.mode === "hardened", sw: { ...opts.sw },
      instant: !!opts.instant, fast: !!opts.fast,
      tokens: 0, tokensTotal: 0, rounds: 0, retries: 0, approvals: 0,
      incidents: [], unapproved: 0, falseClaims: [], caveats: [],
      goals: {}, devices: {}, hit: {}, lostMemory: false, overflowNoted: false, falseCount: 0,
    };
    domain.goals.forEach(g => (S.goals[g.id] = "pending"));
    domain.initState(S);
    this.S = S;
    domain.initWorld(this);
  }

  /* ---------- subscription ---------- */
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  emit = () => { this.version++; this.listeners.forEach(l => l()); };
  abort = () => { this.aborted = true; this.pending?.resolve("__abort__"); };
  setFast = (fast: boolean) => { this.S.fast = fast; };

  /* ---------- state helpers ---------- */
  hit = (id: ConceptId, how: "ok" | "miss" = "ok") => {
    if (!this.S.hit[id] || how === "miss") this.S.hit[id] = how;
    this.emit();
  };
  incident = (text: string, safety: boolean) => { this.S.incidents.push({ text, safety }); this.emit(); };
  setGoal = (id: string, status: GoalStatus) => { this.S.goals[id] = status; this.emit(); };
  setDevice = (id: string, text: string, tone: Tone = "") => { this.S.devices[id] = [text, tone]; this.emit(); };
  addTokens = (n: number) => { this.S.tokens += n; this.S.tokensTotal += n; this.emit(); };
  touch = () => this.emit();

  wait = (ms: number): Promise<void> => {
    if (this.aborted) return Promise.reject(new Aborted());
    if (this.S.instant) return Promise.resolve();
    return new Promise((res, rej) => setTimeout(() => (this.aborted ? rej(new Aborted()) : res()), this.S.fast ? ms * 0.25 : ms));
  };

  /* ---------- trace cards ---------- */
  addCard = (o: {
    actor: Actor; title?: string; code?: string; pre?: string; text?: string; vcls?: VerdictClass;
    concepts?: ConceptId[]; variant?: Card["variant"];
  }): Card => {
    const card: Card = {
      id: this.nextId++, actor: o.actor, title: o.title, code: o.code, pre: o.pre,
      verdict: { cls: o.vcls ?? "pending", text: o.text ?? "running…" },
      concepts: o.concepts ?? [], variant: o.variant, blocks: [],
    };
    this.cards.push(card);
    this.emit();
    return card;
  };
  setV = (card: Card, cls: VerdictClass, text: string) => { card.verdict = { cls, text }; this.emit(); };
  block = (card: Card, b: Block) => { card.blocks.push(b); this.emit(); return b; };
  detail = (card: Card, text: string) => { this.block(card, { kind: "detail", text }); };
  note = (card: Card, text: string) => { this.block(card, { kind: "note", text }); };
  quote = (card: Card, plain: string, injected?: string) => { this.block(card, { kind: "quote", plain, injected }); };
  /** A live-updating progress line. Returns a setter. */
  progress = (card: Card) => {
    const b = this.block(card, { kind: "progress", text: "" }) as Extract<Block, { kind: "progress" }>;
    return (text: string) => { b.text = text; this.emit(); };
  };

  private seq = 0;
  private setNow(tool: string, args?: Record<string, unknown>, tools?: string[]) {
    this.S.now = { tool, args, tools, seq: ++this.seq };
  }

  mround = (tool: string, args?: Record<string, unknown>, concepts?: ConceptId[]) => {
    this.setNow(tool, args);
    this.S.rounds++; this.addTokens(700);
    this.domainHook("onRound");
    return this.addCard({ actor: "model", title: "Round " + this.S.rounds, code: tool + "(" + (args ? inline(args) : "") + ")", concepts });
  };
  think = (text: string, concepts?: ConceptId[]) => {
    this.S.rounds++; this.addTokens(450);
    this.domainHook("onThink");
    return this.addCard({ actor: "model", title: "Round " + this.S.rounds, text, vcls: "info", concepts });
  };
  hcard = (title: string, text: string, cls: VerdictClass = "info", concepts?: ConceptId[]) => {
    this.addTokens(150);
    return this.addCard({ actor: "harness", title, text, vcls: cls, concepts, variant: cls === "danger" ? "naive-fail" : undefined });
  };
  ucard = (title: string, text: string, concepts?: ConceptId[]) => {
    this.addTokens(200);
    return this.addCard({ actor: "user", title, text, vcls: "info", concepts });
  };

  private domainHook(name: "onRound" | "onThink") {
    this.domain[name]?.(this.S);
  }

  /** Pause for a human decision. Instant runs answer automatically with autoId. */
  decide = (card: Card, options: { id: string; label: string }[], autoId: string): Promise<string> => {
    if (this.S.instant) {
      const o = options.find(x => x.id === autoId)!;
      this.note(card, "Example run, answered automatically: " + o.label + ".");
      return Promise.resolve(autoId);
    }
    card.awaiting = true;
    const b = this.block(card, { kind: "choices", options });
    return new Promise<string>((resolve, reject) => {
      this.pending = {
        cardId: card.id,
        resolve: (id: string) => {
          this.pending = null;
          card.awaiting = false;
          card.blocks = card.blocks.filter(x => x !== b);
          if (id === "__abort__") return reject(new Aborted());
          this.note(card, "Chosen: " + options.find(o => o.id === id)!.label + ".");
          resolve(id);
        },
      };
      this.emit();
    });
  };
  choose = (cardId: number, optionId: string) => {
    if (this.pending && this.pending.cardId === cardId) this.pending.resolve(optionId);
  };

  /** The same call repeated: the loop-guard pattern. */
  repeatCall = async (tool: string, args: Record<string, unknown>, hardCount: number, naiveCount: number, onEach?: (S: RunState) => void) => {
    const c = this.mround(tool, args, ["loopguard"]);
    const n = this.S.H ? hardCount : naiveCount;
    for (let i = 2; i <= n; i++) {
      await this.wait(this.S.H ? 300 : 110);
      this.setNow(tool, args);
      this.S.rounds++; this.addTokens(this.S.H ? 450 : 600);
      onEach?.(this.S);
      this.setV(c, "pending", "×" + i + ", same call, same result");
    }
    return c;
  };

  /** One model round that dispatches several tool calls at once. */
  parallelCard = (calls: { id: string; tool: string; args: Record<string, unknown> }[], concepts?: ConceptId[]) => {
    this.setNow(calls[0]?.tool ?? "", calls[0]?.args, calls.map(c => c.tool));
    this.S.rounds++; this.addTokens(900);
    this.domainHook("onRound");
    const card = this.addCard({ actor: "model", title: "Round " + this.S.rounds + " · " + calls.length + " calls in parallel", text: "Dispatched together, results handled one by one.", vcls: "info", concepts });
    const block = this.block(card, { kind: "parallel", rows: calls.map(c => ({ id: c.id, code: c.tool + "(" + inline(c.args) + ")", status: "running", tone: "" as Tone })) }) as Extract<Block, { kind: "parallel" }>;
    return {
      card,
      row: (id: string, status: string, tone: Tone = "") => {
        const r = block.rows.find(x => x.id === id);
        if (r) { r.status = status; r.tone = tone; this.emit(); }
      },
    };
  };

  /** Compaction (hardened) or silent truncation (naive) once the window passes 75%. */
  checkContext = async () => {
    const W = this.domain.window;
    if (this.S.tokens <= W * 0.75) return;
    if (this.S.H) {
      const before = this.S.tokens;
      const c = this.hcard("Context compaction", `Context hit ${k(before)} of ${k(W)} (${Math.round((before / W) * 100)}%). ${this.domain.compactText}`, "info", ["compact", "mem"]);
      this.S.tokens = 5200; this.emit();
      this.detail(c, `window: ${k(before)} → ${k(this.S.tokens)} · summary replaces ${Math.max(1, this.S.rounds - 2)} rounds`);
      this.hit("compact"); this.hit("mem");
      await this.wait(500);
    } else {
      if (!this.S.overflowNoted) {
        this.hcard("Context overflow", this.domain.overflowText, "danger", ["compact", "mem"]);
        this.S.overflowNoted = true; this.S.lostMemory = true;
        this.incident(this.domain.overflowIncident, false);
        this.hit("compact", "miss"); this.hit("mem", "miss");
        await this.wait(500);
      }
      this.S.tokens = Math.round(W * 0.7); this.emit();
    }
  };

  /* ---------- report + score ---------- */
  goalScore = () => {
    let n = 0;
    for (const g of this.domain.goals) {
      const s = this.S.goals[g.id];
      if (s === "done" || s === "fallback") n += 1;
      else if (s === "partial") n += 0.5;
    }
    return n;
  };

  private async report() {
    const D = this.domain, S = this.S;
    D.finalizeGoals(this);
    this.addTokens(600);
    let intro = S.H ? D.reportIntroH : D.reportIntroN;
    if (typeof intro === "function") intro = intro(S);
    const c = this.addCard({ actor: "model", title: D.reportTitle, text: intro, vcls: "info", concepts: ["stophook"] });
    const lines = D.reportLines(S);
    S.falseCount = lines.filter(l => l[0] === "false").length;
    this.block(c, { kind: "report", lines });
    await this.wait(700);
  }

  private score() {
    const D = this.domain, S = this.S;
    this.hit("eval");
    const handled = Object.values(S.hit).filter(v => v === "ok").length;
    const missed = Object.values(S.hit).filter(v => v === "miss").length;
    const r: RunResult = {
      goals: this.goalScore(), safety: S.incidents.filter(i => i.safety).length, unapproved: S.unapproved,
      falseClaims: S.falseCount, rounds: S.rounds, tokens: S.tokensTotal, retries: S.retries, approvals: S.approvals,
      handled, missed, switches: D.switches.filter(s => S.sw[s.id]).length,
      ...D.extraResult(S),
    };
    this.result = r;
    const c = this.addCard({
      actor: "eval", title: "Scorecard",
      text: missed ? `${missed} concepts hit but not handled.` : "Every concept that came up was handled.",
      vcls: missed ? "danger" : "success", concepts: ["eval"],
    });
    const metrics: { label: string; value: string; good?: boolean }[] = [
      { label: "Goals met", value: `${r.goals} / ${D.goals.length}`, good: r.goals >= D.goals.length - 1 },
      { label: "Safety incidents", value: String(r.safety), good: !r.safety },
      { label: "Unapproved risky acts", value: String(r.unapproved), good: !r.unapproved },
      { label: "False claims", value: String(r.falseClaims), good: !r.falseClaims },
      ...D.extraMetrics(S).map(([label, value, good]) => ({ label, value, good })),
      { label: "Rounds", value: String(r.rounds) },
      { label: "Tokens used", value: k(r.tokens) },
      { label: "Retries", value: String(r.retries) },
      { label: "Approvals asked", value: String(r.approvals) },
    ];
    this.block(c, { kind: "score", metrics });
    if (S.incidents.length) this.detail(c, "incidents: " + S.incidents.map(i => i.text).join(" · "));
  }

  /** Runs every beat, then the report and scorecard. Resolves with the result (or null if aborted). */
  start = async (): Promise<RunResult | null> => {
    try {
      const beats = this.domain.beats(this);
      for (let i = 0; i < beats.length; i++) {
        await beats[i]();
        if (i < beats.length - 1) await this.checkContext();
      }
      this.S.now = null;
      await this.report();
      this.score();
      this.done = true;
      this.S.finished = true;
      this.emit();
      return this.result;
    } catch (e) {
      if (e instanceof Aborted) return null;
      throw e;
    }
  };

  conceptLabel = (id: ConceptId) => CONCEPT_BY_ID[id].label;
}

/** Run a domain start to finish with no delays and automatic decisions. */
export async function runInstant(domain: Domain, mode: Mode, sw: Record<string, boolean>) {
  const run = new Run(domain, { mode, sw, instant: true });
  await run.start();
  return run;
}

export function allSwitches(domain: Domain, value = true) {
  return Object.fromEntries(domain.switches.map(s => [s.id, value]));
}
