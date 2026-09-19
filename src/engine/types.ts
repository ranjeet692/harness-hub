import type { ComponentType } from "react";
import type { ConceptId } from "./concepts";
import type { Run } from "./run";
import type { LiveSpec } from "../live/types";

export type Mode = "hardened" | "naive";
export type Actor = "model" | "harness" | "user" | "subagent" | "eval";
export type Tone = "" | "good" | "warn" | "danger" | "info";
export type VerdictClass = "pending" | "success" | "warn" | "danger" | "info";
export type GoalStatus = "pending" | "active" | "done" | "fallback" | "partial" | "failed" | "declined" | "skipped";

export type Block =
  | { kind: "detail"; text: string }
  | { kind: "note"; text: string }
  | { kind: "progress"; text: string }
  | { kind: "text"; text: string }
  | { kind: "quote"; plain: string; injected?: string }
  | { kind: "parallel"; rows: { id: string; code: string; status: string; tone: Tone }[] }
  | { kind: "report"; lines: ReportLine[] }
  | { kind: "score"; metrics: { label: string; value: string; good?: boolean }[] }
  | { kind: "choices"; options: { id: string; label: string }[] };

export type ReportLine = ["ok" | "caveat" | "false", string];

export interface Card {
  id: number;
  actor: Actor;
  title?: string;
  code?: string;
  pre?: string;
  verdict: { cls: VerdictClass; text: string };
  concepts: ConceptId[];
  variant?: "context" | "naive-fail";
  awaiting?: boolean;
  blocks: Block[];
}

export interface Incident { text: string; safety: boolean }

/** Base run state. Domains add their own fields. */
export interface RunState {
  mode: Mode;
  H: boolean;
  sw: Record<string, boolean>;
  instant: boolean;
  fast: boolean;
  tokens: number;
  tokensTotal: number;
  rounds: number;
  retries: number;
  approvals: number;
  incidents: Incident[];
  unapproved: number;
  falseClaims: string[];
  caveats: string[];
  goals: Record<string, GoalStatus>;
  devices: Record<string, [string, Tone]>;
  hit: Partial<Record<ConceptId, "ok" | "miss">>;
  lostMemory: boolean;
  overflowNoted: boolean;
  falseCount: number;
  // domain-specific fields
  [key: string]: any;
}

export interface RunResult {
  goals: number;
  safety: number;
  unapproved: number;
  falseClaims: number;
  rounds: number;
  tokens: number;
  retries: number;
  approvals: number;
  handled: number;
  missed: number;
  switches: number;
  [key: string]: number;
}

export interface Gauge { label: string; text: string; pct: number; marker: number; markerTitle?: string; cls?: "" | "warn" | "danger" }
export type Metric = [label: string, value: string, good?: boolean];
export type CompareRow = [label: string, key: string, better: "low" | "high" | null, fmt: (v: number) => string];
export type Beat = () => Promise<void>;

export interface Domain {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  tagline: string;
  eyebrow: string;
  dek: string;
  requestLabel: string;
  request: string;
  userLabel: string;
  runLabel: string;
  window: number;
  modeHelp: Record<Mode, string>;
  /** Domain-specific explanation of each concept. */
  concepts: Record<ConceptId, string>;
  switches: { id: string; label: string }[];
  goals: { id: string; label: string }[];
  devices: { id: string; label: string }[];
  initState(S: RunState): void;
  initWorld(run: Run): void;
  gauge2(S: RunState): Gauge;
  stats: [string, (S: RunState) => string | number][];
  compactText: string;
  overflowText: string;
  overflowIncident: string;
  reportTitle: string;
  reportIntroH: string | ((S: RunState) => string);
  reportIntroN: string | ((S: RunState) => string);
  /** Builds this run's beats. Called once per run with the live run as helper. */
  beats(run: Run): Beat[];
  finalizeGoals(run: Run): void;
  reportLines(S: RunState): ReportLine[];
  extraMetrics(S: RunState): Metric[];
  extraResult(S: RunState): Record<string, number>;
  compareRows: CompareRow[];
  /** Optional per-round side effects, e.g. advancing a clock. */
  onRound?(S: RunState): void;
  onThink?(S: RunState): void;
  Scene?: ComponentType<{ S: RunState }>;
  live?: LiveSpec;
}
