/* Server entry for prerendering: renders one app path to HTML. Used only at build time
   (scripts/prerender.mjs); the browser bundle starts from main.tsx. */
import { renderToString } from "react-dom/server";
import { App } from "./App";
import { setServerPath } from "./router";
import { headTags, metaFor, routes } from "./seo";
import { SITE } from "./site";

export function render(path: string) {
  setServerPath(path);
  const html = renderToString(<App />);
  return { html, head: headTags(metaFor(path)) };
}

export { headTags, metaFor, routes, SITE };
