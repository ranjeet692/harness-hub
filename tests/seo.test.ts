import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { App } from "../src/App";
import { BASE, appPath, href, setServerPath } from "../src/router";
import { headTags, metaFor, routes } from "../src/seo";
import { SITE } from "../src/site";

describe("URLs", () => {
  it("builds directory-style links under the base", () => {
    expect(href("/")).toBe(BASE);
    expect(href("/concepts/memory")).toBe(`${BASE}concepts/memory/`);
    expect(href("/d/coding?concept=idem")).toBe(`${BASE}d/coding/?concept=idem`);
  });

  it("reads app paths back from the browser's path", () => {
    expect(appPath(BASE)).toBe("");
    expect(appPath(`${BASE}concepts/memory/`)).toBe("concepts/memory");
    expect(appPath(`${BASE}d/coding/index.html`)).toBe("d/coding");
  });
});

describe("page metadata", () => {
  const all = routes().map(p => [p, metaFor(p)] as const);

  it("lists every harness, concept and Blueprint page, once", () => {
    const r = routes();
    expect(new Set(r).size).toBe(r.length);
    for (const p of ["/", "/about", "/concepts", "/concepts/idempotency", "/d/onboarding", "/d/onboarding/blueprint", "/blueprint", "/blueprint/guide"]) expect(r).toContain(p);
  });

  it("gives every indexable page a unique title and description of a sensible length", () => {
    const own = all.filter(([p, m]) => m.canonical === SITE.url + "/" + href(p).slice(BASE.length));
    const titles = own.map(([, m]) => m.title), descs = own.map(([, m]) => m.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descs).size).toBe(descs.length);
    for (const [p, m] of all) {
      expect(m.title.length, p).toBeLessThanOrEqual(80);
      expect(m.description.length, p).toBeGreaterThanOrEqual(70);
      expect(m.description.length, p).toBeLessThanOrEqual(160);
      expect(m.noindex, p).toBeFalsy();
    }
  });

  it("points canonicals at the absolute, trailing-slash URL", () => {
    expect(metaFor("/concepts/memory").canonical).toBe(`${SITE.url}/concepts/memory/`);
    expect(metaFor("/").canonical).toBe(`${SITE.url}/`);
    expect(metaFor("/blueprint/build/tools").canonical).toBe(`${SITE.url}/blueprint/build/requirement/`);
  });

  it("marks unknown pages noindex", () => {
    expect(metaFor("/nope").noindex).toBe(true);
  });

  it("emits valid JSON-LD naming the author", () => {
    const tags = headTags(metaFor("/"));
    const json = [...tags.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    expect(json.length).toBeGreaterThan(0);
    expect(JSON.stringify(json)).toContain(SITE.author.name);
    expect(tags).toContain('<meta property="og:image"');
    expect(tags).not.toMatch(/<script[^>]*>[^<]*<\/script>[^<]*<\/script>/);
  });
});

describe("prerendering", () => {
  it("renders each kind of page to HTML with its h1 and real links", () => {
    for (const [path, h1] of [["/", "harness"], ["/concepts/idempotency", "Idempotency"], ["/d/onboarding", "Onboarding"], ["/about", "harness"], ["/blueprint/guide", "harness"]] as const) {
      setServerPath(path);
      const html = renderToString(createElement(App));
      expect(html, path).toMatch(new RegExp(`<h1[^>]*>[\\s\\S]*${h1}`));
      expect(html, path).toContain(`href="${BASE}concepts/"`);
      expect(html, path).not.toContain('href="#/');
    }
  });
});
