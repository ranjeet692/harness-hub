/**
 * Runs the mini repo's unit tests against whatever code the model has written.
 *
 * The runner source is a plain string so the exact same code runs in a Web Worker in the
 * browser (isolated, with a hard time limit, so a runaway loop can't freeze the tab) and
 * through `new Function` under Node for the test suite.
 */
export interface SuiteResult { passed: number; failed: number; failures: { name: string; message: string }[]; timedOut?: boolean }

export const UNIT_CASES = [
  { name: "applies a 10% code", mod: "pricing", fn: "applyDiscount", args: [10000, 10], want: 9000 },
  { name: "rounds to whole paise", mod: "pricing", fn: "applyDiscount", args: [999, 33], want: 669 },
  { name: "treats a 0% code as no discount", mod: "pricing", fn: "applyDiscount", args: [10000, 0], want: 10000 },
  { name: "100% code makes it free", mod: "pricing", fn: "applyDiscount", args: [10000, 100], want: 0 },
  { name: "clamps codes over 100% (#482)", mod: "pricing", fn: "applyDiscount", args: [10000, 145], want: 0 },
  { name: "multiplies unit price by quantity", mod: "pricing", fn: "lineTotal", args: [250, 3], want: 750 },
  { name: "formats paise as rupees", mod: "pricing", fn: "formatPrice", args: [123456], want: "₹1,234.56" },
  { name: "formats small amounts", mod: "pricing", fn: "formatPrice", args: [5], want: "₹0.05" },
  { name: "cart with a 145% code totals ₹0 (#482)", mod: "cart", fn: "cartTotal", args: [[{ unitPaise: 5000, qty: 2 }], { pct: 145 }], want: 0 },
];

export const RUNNER_SOURCE = String.raw`
const cases = __CASES__;
const FORBIDDEN = /\b(fetch|XMLHttpRequest|WebSocket|require|process|globalThis|window|self|document|localStorage|sessionStorage|indexedDB|eval|Function|setTimeout|setInterval|importScripts|postMessage)\b|\bimport\s*\(|while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/;
function load(src, imports, path) {
  if (typeof src !== "string") throw new Error(path + " is missing");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const bad = code.match(FORBIDDEN);
  if (bad) throw new Error("sandbox: " + path + " uses \"" + bad[0] + "\", which isn't allowed here");
  const names = [];
  let body = code.replace(/^\s*import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?/gm, function (m, n, from) {
    return "const {" + n + "} = __imports[" + JSON.stringify(from) + "] || {};";
  });
  body = body.replace(/^export\s+(async\s+)?(function|const|let)\s+(\w+)/gm, function (m, a, kind, name) {
    names.push(name);
    return (a || "") + kind + " " + name;
  });
  return new Function("__imports", '"use strict";\n' + body + "\nreturn {" + names.join(",") + "};")(imports || {});
}
let pricing, cart;
try {
  pricing = load(files["src/checkout/pricing.js"], {}, "src/checkout/pricing.js");
  cart = load(files["src/checkout/cart.js"], { "./pricing.js": pricing }, "src/checkout/cart.js");
} catch (e) {
  return { passed: 0, failed: cases.length, failures: [{ name: "loading modules", message: String((e && e.message) || e) }] };
}
const mods = { pricing: pricing, cart: cart };
const failures = [];
let passed = 0;
for (const c of cases) {
  try {
    const fn = mods[c.mod][c.fn];
    if (typeof fn !== "function") throw new Error(c.fn + " is not exported");
    const got = fn.apply(null, JSON.parse(JSON.stringify(c.args)));
    if (got === c.want) passed++;
    else failures.push({ name: c.name, message: "expected " + JSON.stringify(c.want) + ", received " + JSON.stringify(got) });
  } catch (e) {
    failures.push({ name: c.name, message: String((e && e.message) || e) });
  }
}
return { passed: passed, failed: failures.length, failures: failures };
`.replace("__CASES__", JSON.stringify(UNIT_CASES));

function runSync(files: Record<string, string>): SuiteResult {
  try {
    return new Function("files", RUNNER_SOURCE)(files) as SuiteResult;
  } catch (e) {
    return { passed: 0, failed: UNIT_CASES.length, failures: [{ name: "runner", message: String((e as Error).message ?? e) }] };
  }
}

/** Run in an isolated worker with a time limit when available, synchronously otherwise. */
export function runUnitTests(files: Record<string, string>, timeoutMs = 2000): Promise<SuiteResult> {
  if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) {
    return Promise.resolve(runSync(files));
  }
  const src = `self.onmessage = function (e) { var files = e.data; var r; try { r = (function (files) {${RUNNER_SOURCE}})(files); } catch (err) { r = { passed: 0, failed: 1, failures: [{ name: "runner", message: String(err) }] }; } self.postMessage(r); };`;
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  const worker = new Worker(url);
  return new Promise(resolve => {
    const done = (r: SuiteResult) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve(r); };
    const timer = setTimeout(() => done({ passed: 0, failed: UNIT_CASES.length, timedOut: true, failures: [{ name: "runner", message: `tests didn't finish within ${timeoutMs / 1000} s (an infinite loop?)` }] }), timeoutMs);
    worker.onmessage = e => done(e.data as SuiteResult);
    worker.onerror = e => done({ passed: 0, failed: UNIT_CASES.length, failures: [{ name: "runner", message: e.message }] });
    worker.postMessage(files);
  });
}
