/* Per-page metadata: title, description, canonical URL, Open Graph and JSON-LD. Used at build
   time to prerender every page's <head>, and in the browser to keep the head in step as you
   navigate. Every indexable URL is listed in routes(), which also feeds the sitemap. */

import { CONCEPTS } from "./engine/concepts";
import { DOMAINS, DOMAIN_BY_ID } from "./domains";
import { STEPS } from "./blueprint/model";
import { SITE, authorLinks } from "./site";

export interface Meta {
  title: string;
  description: string;
  /** App path, e.g. "/concepts/memory". */
  path: string;
  canonical: string;
  type: "website" | "article";
  noindex?: boolean;
  image: string;
  jsonld: object[];
}

const abs = (path: string) => SITE.url + "/" + path.replace(/^\/+|\/+$/g, "") + (path.replace(/^\/+|\/+$/g, "") ? "/" : "");
const clip = (s: string, n = 158) => { const t = s.replace(/\s+/g, " ").trim(); return t.length <= n ? t : t.slice(0, n - 1).replace(/[\s,.;:]+\S*$/, "") + "…"; };
const plain = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

const person = () => ({
  "@type": "Person", "@id": SITE.url + "/about/#author", name: SITE.author.name, url: abs("/about"), sameAs: authorLinks(),
  knowsAbout: ["AI agent harness engineering", "LLM agents", "Agent evaluation", "Tool use", "Prompt injection defense", "TypeScript", "React"],
});
const website = () => ({
  "@type": "WebSite", "@id": SITE.url + "/#website", name: SITE.name, url: abs("/"), description: SITE.description,
  inLanguage: "en", author: { "@id": SITE.url + "/about/#author" }, publisher: { "@id": SITE.url + "/about/#author" },
});
const crumbs = (items: [string, string][]) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
});
const graph = (...nodes: object[]) => [{ "@context": "https://schema.org", "@graph": nodes }];

/** Every indexable page, in sitemap order. */
export function routes(): string[] {
  return [
    "/", "/about", "/concepts", ...CONCEPTS.map(c => `/concepts/${c.slug}`),
    ...DOMAINS.flatMap(d => [`/d/${d.id}`, `/d/${d.id}/blueprint`, `/d/${d.id}/evals`]),
    "/blueprint", "/blueprint/guide", ...STEPS.map(s => `/blueprint/build/${s.id}`),
    "/contribute",
  ];
}

export function metaFor(path: string): Meta {
  const segs = path.split("?")[0].split("/").filter(Boolean);
  const [a, b, c] = segs;
  const clean = "/" + segs.join("/");
  const base = { path: clean, canonical: abs(clean), type: "website" as const, image: SITE.url + "/og.png" };

  if (!a) return {
    ...base,
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.description,
    jsonld: graph(website(), person(), {
      "@type": "SoftwareSourceCode", name: SITE.name, codeRepository: SITE.repo, programmingLanguage: ["TypeScript", "React"],
      license: "https://opensource.org/licenses/MIT", author: { "@id": SITE.url + "/about/#author" }, description: SITE.description,
    }, {
      "@type": "ItemList", name: "Agent harnesses",
      itemListElement: DOMAINS.map((d, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/d/${d.id}`), name: `${d.shortTitle} harness` })),
    }),
  };

  if (a === "about" && !b) return {
    ...base, type: "article",
    title: `About · ${SITE.author.name}, AI engineer · ${SITE.name}`,
    description: clip(`${SITE.author.name} designed and built harness-hub: a harness engine, six agent scenarios with hardened and naive runs, a live mode on a real Claude model, evals, and Blueprint, a method from client requirement to harness design.`),
    jsonld: graph({ "@type": "ProfilePage", url: abs("/about"), name: `About ${SITE.author.name}`, mainEntity: { "@id": SITE.url + "/about/#author" } }, person(),
      crumbs([["Home", "/"], ["About", "/about"]])),
  };

  if (a === "d" && b && DOMAIN_BY_ID[b]) {
    const d = DOMAIN_BY_ID[b];
    const raw = d.title.replace(/^The /, "").replace(/ Harness$/, "");
    const name = /agent$/i.test(raw) ? raw.replace(/ Agent$/, " agent") : raw + " agent";
    if (c === "evals") return {
      ...base, type: "article",
      title: `${name} evals: scenarios, ablation and release gate · ${SITE.name}`,
      description: clip(`How the ${d.shortTitle.toLowerCase()} harness is evaluated: every edge case through a hardened and a naive harness, an ablation of each concept, code-graded goals and a CI release gate.`),
      jsonld: graph({ "@type": "TechArticle", headline: `${name}: evaluation suite`, url: abs(clean), author: { "@id": SITE.url + "/about/#author" }, about: ["AI agent evaluation", "Ablation study"], isPartOf: { "@id": SITE.url + "/#website" } }, person(),
        crumbs([["Harnesses", "/"], [`${d.shortTitle}`, `/d/${d.id}`], ["Evals", clean]])),
    };
    if (c === "blueprint") return {
      ...base, type: "article",
      title: `${name} design: HLD, LLD and traceability · ${SITE.name}`,
      description: clip(`How the ${d.shortTitle.toLowerCase()} harness is designed: the job, sources of truth, autonomy per action, tool tiers, and every edge case traced to a concept and a check. ${plain(d.tagline)}`),
      jsonld: graph({ "@type": "TechArticle", headline: `${name}: harness design`, url: abs(clean), author: { "@id": SITE.url + "/about/#author" }, about: "AI agent harness design", isPartOf: { "@id": SITE.url + "/#website" } }, person(),
        crumbs([["Harnesses", "/"], [`${d.shortTitle}`, `/d/${d.id}`], ["Blueprint", clean]])),
    };
    return {
      ...base,
      title: `${name} harness: hardened vs naive · ${SITE.name}`,
      description: clip(`${plain(d.tagline)} Run it, switch on edge cases, and compare a hardened harness with a naive one.`),
      jsonld: graph({
        "@type": "LearningResource", name: `${name} harness`, url: abs(clean), description: plain(d.dek), learningResourceType: "Interactive simulation",
        teaches: d.switches.map(s => s.label), author: { "@id": SITE.url + "/about/#author" }, isPartOf: { "@id": SITE.url + "/#website" },
      }, person(), crumbs([["Harnesses", "/"], [d.shortTitle, clean]])),
    };
  }

  if (a === "concepts" && !b) return {
    ...base,
    title: `20 AI agent harness concepts, explained · ${SITE.name}`,
    description: clip("Context assembly, memory, compaction, tool tiers, schema validation, retries, timeouts, idempotency, loop guards, stop hooks, confirmation gates, budget guards, injection defense, compensation and scorecards: why each matters and how to build it."),
    jsonld: graph({
      "@type": "ItemList", name: "AI agent harness concepts",
      itemListElement: CONCEPTS.map((x, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/concepts/${x.slug}`), name: x.label })),
    }, crumbs([["Home", "/"], ["Concepts", "/concepts"]])),
  };

  if (a === "concepts" && b) {
    const x = CONCEPTS.find(k => k.slug === b);
    if (x) return {
      ...base, type: "article",
      title: `${x.label} in AI agent harnesses · ${SITE.name}`,
      description: clip(`${x.summary} ${x.why}`),
      jsonld: graph({
        "@type": "TechArticle", headline: `${x.label} in AI agent harnesses`, description: x.summary, url: abs(clean), articleSection: x.group,
        author: { "@id": SITE.url + "/about/#author" }, isPartOf: { "@id": SITE.url + "/#website" }, about: [x.label, "AI agents"],
      }, person(), crumbs([["Concepts", "/concepts"], [x.label, clean]])),
    };
  }

  if (a === "blueprint" && !b) return {
    ...base,
    title: `Blueprint: from a client requirement to an AI agent design · ${SITE.name}`,
    description: clip("A method and a free builder for turning a requirement into an AI agent harness design: high-level design, low-level design, and every requirement traced to a test. Exports a client proposal, a design doc and a harness skeleton."),
    jsonld: graph({ "@type": "WebPage", name: "Blueprint", url: abs(clean), author: { "@id": SITE.url + "/about/#author" } }, crumbs([["Home", "/"], ["Blueprint", clean]])),
  };
  if (a === "blueprint" && b === "guide") return {
    ...base, type: "article",
    title: `How to design an AI agent from a requirement (HLD and LLD) · ${SITE.name}`,
    description: clip("Nine steps from a client's requirement to an AI agent harness design: the job, sources of truth, autonomy per action, risks, the loop, tools, guards and evals, with a worked example of an invoice agent."),
    jsonld: graph({
      "@type": "HowTo", name: "Design an AI agent harness from a requirement", url: abs(clean),
      step: STEPS.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.label, url: abs(clean) + "#" + s.id })),
    }, { "@type": "TechArticle", headline: "From requirement to harness", url: abs(clean), author: { "@id": SITE.url + "/about/#author" } }, person(),
      crumbs([["Blueprint", "/blueprint"], ["Guide", clean]])),
  };
  if (a === "blueprint" && b === "build") return {
    ...base,
    canonical: abs("/blueprint/build/requirement"),
    title: `Blueprint builder${c ? `: ${STEPS.find(s => s.id === c)?.label ?? ""}` : ""} · ${SITE.name}`,
    description: clip("Paste a requirement and design the AI agent around it: the phrases that imply guards, autonomy per action, a tool table, a decision for each of 20 concepts, and exports for clients and engineers. Runs in your browser."),
    jsonld: graph({ "@type": "WebApplication", name: "Blueprint builder", url: abs("/blueprint/build/requirement"), applicationCategory: "DeveloperApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, author: { "@id": SITE.url + "/about/#author" } }),
  };

  if (a === "contribute" && !b) return {
    ...base,
    title: `Add a harness · ${SITE.name}`,
    description: clip("A harness is one TypeScript module: its tools, goals, edge cases and steps. The engine, timeline, scorecard and tests come with it. Here's how to add yours."),
    jsonld: graph(crumbs([["Home", "/"], ["Contribute", clean]])),
  };

  return { ...base, title: `Page not found · ${SITE.name}`, description: SITE.description, noindex: true, jsonld: [] };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The <head> tags for a page, as HTML. */
export function headTags(m: Meta): string {
  const tags = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${m.canonical}" />`,
    m.noindex ? `<meta name="robots" content="noindex" />` : `<meta name="robots" content="index,follow,max-image-preview:large" />`,
    `<meta name="author" content="${esc(SITE.author.name)}" />`,
    `<meta name="keywords" content="${esc(SITE.keywords.join(", "))}" />`,
    `<meta property="og:site_name" content="${SITE.name}" />`,
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${m.canonical}" />`,
    `<meta property="og:image" content="${m.image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="harness-hub: the model is the engine, the harness is the car." />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${m.image}" />`,
    ...m.jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`),
  ];
  return tags.join("\n    ");
}

/** Keep the live document's head in step with the route (titles, description, canonical, OG). */
export function applyMeta(m: Meta) {
  document.title = m.title;
  const set = (sel: string, attr: string, val: string) => { const el = document.head.querySelector(sel); if (el) el.setAttribute(attr, val); };
  set('meta[name="description"]', "content", m.description);
  set('link[rel="canonical"]', "href", m.canonical);
  set('meta[property="og:title"]', "content", m.title);
  set('meta[property="og:description"]', "content", m.description);
  set('meta[property="og:url"]', "content", m.canonical);
  set('meta[name="twitter:title"]', "content", m.title);
  set('meta[name="twitter:description"]', "content", m.description);
  set('meta[name="robots"]', "content", m.noindex ? "noindex" : "index,follow,max-image-preview:large");
}

