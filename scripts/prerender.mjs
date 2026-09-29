/* Prerender every page to static HTML, then write the sitemap, robots.txt and 404 page.
   Runs after `vite build` (client) and `vite build --ssr src/entry-server.tsx` (server).
   Each route becomes dist/<path>/index.html with its own <title>, description, canonical,
   Open Graph tags and JSON-LD, and the page's content already in the markup. */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const server = await import(pathToFileURL(join(root, "dist-ssr", "entry-server.js")).href);
const { render, routes, metaFor, headTags, SITE } = server;

const template = readFileSync(join(dist, "index.html"), "utf8");
if (!template.includes("<!--app-head-->") || !template.includes("<!--app-html-->")) throw new Error("index.html is missing the <!--app-head--> or <!--app-html--> slot");

const page = (head, html) => template.replace("<!--app-head-->", head).replace("<!--app-html-->", html);

const list = routes();
for (const path of list) {
  const { html, head } = render(path);
  const file = join(dist, path.replace(/^\/+/, ""), "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page(head, html));
}

// Unknown URLs: GitHub Pages serves 404.html. It carries the app, which shows its own not-found page.
{
  const { html } = render("/404");
  writeFileSync(join(dist, "404.html"), page(headTags(metaFor("/404")), html));
}

const today = new Date().toISOString().slice(0, 10);
const loc = p => metaFor(p).canonical;
const indexable = list.filter(p => !metaFor(p).noindex && metaFor(p).canonical === loc(p) && (!p.startsWith("/blueprint/build/") || p === "/blueprint/build/requirement"));
const priority = p => (p === "/" ? "1.0" : /^\/(d\/[^/]+|blueprint|concepts|about)$/.test(p) ? "0.8" : "0.6");
writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map(p => `  <url><loc>${loc(p)}</loc><lastmod>${today}</lastmod><priority>${priority(p)}</priority></url>`).join("\n")}
</urlset>
`);

writeFileSync(join(dist, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${SITE.url}/sitemap.xml
`);

rmSync(join(root, "dist-ssr"), { recursive: true, force: true });
console.log(`prerendered ${list.length} pages, sitemap with ${indexable.length} URLs → ${SITE.url}/sitemap.xml`);
