/* Server entry for prerendering: renders one app path to HTML. Used only at build time
   (scripts/prerender.mjs); the browser bundle starts from main.tsx. */
import { renderToString } from "react-dom/server";
import { App } from "./App";
import { setServerPath } from "./router";
import { headTags, metaFor, routes } from "./seo";
import { SITE } from "./site";
import { DOMAINS } from "./domains";
import { warmSuite } from "./evals/suite";
import { warmTrace } from "./components/ProductionTab";

/** Run every harness's eval suite once so prerendered Evals pages carry real numbers. */
export async function warmEvals() { for (const d of DOMAINS) { await warmSuite(d); await warmTrace(d); } }

export function render(path: string) {
  setServerPath(path);
  const html = renderToString(<App />);
  return { html, head: headTags(metaFor(path)) };
}

export { headTags, metaFor, routes, SITE };
