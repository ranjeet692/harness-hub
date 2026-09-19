import type { ObjectSchema } from "./types";

/** Minimal JSON-schema check for tool inputs. Returns human-readable problems, empty if valid. */
export function validate(schema: ObjectSchema, input: unknown): string[] {
  const problems: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return ["arguments must be an object"];
  const obj = input as Record<string, unknown>;
  for (const key of schema.required ?? []) {
    if (!(key in obj)) problems.push(`${key} is required`);
  }
  for (const [key, value] of Object.entries(obj)) {
    const p = schema.properties[key];
    if (!p) {
      if (schema.additionalProperties === false) problems.push(`${key} is not a known argument`);
      continue;
    }
    if (p.type === "integer" && !(typeof value === "number" && Number.isInteger(value))) problems.push(`${key} must be an integer, got ${JSON.stringify(value)}`);
    else if (p.type === "number" && typeof value !== "number") problems.push(`${key} must be a number, got ${JSON.stringify(value)}`);
    else if (p.type === "string" && typeof value !== "string") problems.push(`${key} must be a string, got ${JSON.stringify(value)}`);
    else if (p.type === "boolean" && typeof value !== "boolean") problems.push(`${key} must be true or false, got ${JSON.stringify(value)}`);
    if (p.enum && !p.enum.includes(value as string | number)) problems.push(`${key} must be one of ${p.enum.join(", ")}, got ${JSON.stringify(value)}`);
    if (typeof value === "number") {
      if (p.minimum !== undefined && value < p.minimum) problems.push(`${key} must be ≥ ${p.minimum}, got ${value}`);
      if (p.maximum !== undefined && value > p.maximum) problems.push(`${key} must be ≤ ${p.maximum}, got ${value}`);
    }
  }
  return problems;
}
