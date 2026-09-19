/** Small formatting helpers shared by the engine, domains and UI. */
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const k = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n)));
export const mmss = (sec: number) => {
  const s = Math.round(sec);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
export const pct = (v: number) => Math.round(v * 100) + "%";

/** Render a JS value the way a tool call reads in a trace: { key: "value", n: 3 }. */
export function inline(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(inline).join(", ") + "]";
  if (v && typeof v === "object")
    return "{ " + Object.entries(v as Record<string, unknown>).map(([key, val]) => key + ": " + inline(val)).join(", ") + " }";
  if (typeof v === "string") return '"' + v + '"';
  return String(v);
}
