import type { ConceptId } from "../engine/concepts";
import type { GoalStatus, Incident, Mode, RunState, Tone } from "../engine/types";

export type Tier = "safe" | "confirm" | "never";

export interface PropSchema {
  type: "string" | "integer" | "number" | "boolean";
  description?: string;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
}
export interface ObjectSchema {
  type: "object";
  properties: Record<string, PropSchema>;
  required?: string[];
  additionalProperties?: false;
}

export interface LiveTool {
  name: string;
  description: string;
  input_schema: ObjectSchema;
  tier: Tier;
  /** The harness attaches an idempotency key and retries timeouts with the same key. */
  idempotent?: boolean;
}

export type Outcome =
  | { ok: true; result: unknown; untrusted?: boolean; ends?: boolean }
  | { ok: false; error: string; transient?: boolean; timeout?: boolean };

export interface ExecContext {
  mode: Mode;
  idempotencyKey?: string;
}

/** Everything a domain needs to provide to run with a real model behind the harness. */
export interface LiveSpec<W = any> {
  /** World-side faults the simulator can inject. Model-side mistakes can't be forced. */
  faults: { id: string; label: string }[];
  /** Edge cases that only happen if the model itself makes the mistake. */
  modelSide: string;
  tools: LiveTool[];
  systemPrompt(mode: Mode): string;
  userMessage(mode: Mode, faults: Record<string, boolean>): string;
  /** A message from the user that arrives mid-run, if the fault is on. */
  steer?: {
    faultId: string;
    afterRound: number;
    text: string;
    /** Called when the message is sent, in both modes (the customer did ask). */
    onIssue(world: W): void;
    /** Called only when the harness actually delivers it to the model. */
    deliver(world: W): void;
  };
  /** Called when the human declines a confirm-tier call. */
  onDecline?(name: string, input: Record<string, unknown>, world: W): void;
  initWorld(faults: Record<string, boolean>): W;
  execute(name: string, input: Record<string, unknown>, world: W, ctx: ExecContext): Outcome | Promise<Outcome>;
  /** Hardened-only checks before execution (budgets, allergens). Return an error to block. */
  guard?(name: string, input: Record<string, unknown>, world: W): { error: string; concept: ConceptId } | null;
  /** Hardened-only: does this particular call need a human? Defaults to tier === "confirm". */
  needsConfirm?(name: string, input: Record<string, unknown>, world: W): boolean;
  confirmText(name: string, input: Record<string, unknown>, world: W): { question: string; approve: string; decline: string };
  /** Checked by the stop hook and the scorecard. */
  verify(world: W): { goals: Record<string, GoalStatus>; gaps: string[] };
  incidents(world: W): Incident[];
  devices(world: W): Record<string, [string, Tone]>;
  /** Maps the world onto the scripted scene's state shape, so the same Scene component renders it. */
  sceneState?(world: W): Partial<RunState>;
  /** The domain's own gauge (a ticket clock, a diff budget). */
  gauge?(world: W): { label: string; text: string; pct: number; marker: number; cls?: "" | "warn" | "danger" };
  /** Copy for the console and the harness's context cards. */
  readyText: string;
  pinnedNote: string;
  truncatedNote: string;
}

/* ---- Messages API shapes (the subset we use) ---- */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface Message { role: "user" | "assistant"; content: string | ContentBlock[] }

export interface ModelRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: Message[];
  tools: { name: string; description: string; input_schema: ObjectSchema }[];
}
export interface ModelResponse {
  content: ContentBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}
export interface ModelClient { create(req: ModelRequest, signal?: AbortSignal): Promise<ModelResponse> }
