import { useEffect, useState } from "react";

/**
 * A tiny path router. Every page has a real URL (/harness-hub/concepts/idempotency/), so each
 * one can be prerendered to its own HTML file, indexed by search engines and shared with a
 * proper preview. In the browser, clicks on internal links are handled here with pushState,
 * so moving between pages doesn't reload.
 *
 * Old hash links (#/concepts/idempotency) still work: they're rewritten to the path on load.
 */
export interface Route { path: string[]; query: URLSearchParams }

/** The site's base path, from Vite's `base` ("/harness-hub/"). */
export const BASE = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

let serverUrl: string | null = null;
/** Prerendering: render as if the browser were at this app path ("/concepts/memory"). */
export function setServerPath(path: string) { serverUrl = path; }

/** "/concepts/memory?x=1" → "/harness-hub/concepts/memory/?x=1". Directory-style URLs, like the prerendered files. */
export function href(path: string): string {
  const [p, q] = path.split("?");
  const clean = p.replace(/^\/+|\/+$/g, "");
  return BASE + (clean ? clean + "/" : "") + (q ? "?" + q : "");
}

/** Strip the base and slashes: "/harness-hub/concepts/memory/" → "concepts/memory". */
export function appPath(pathname: string): string {
  let p = pathname;
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  else if (p + "/" === BASE) p = "";
  return p.replace(/^\/+|\/+$/g, "").replace(/\/index\.html$/, "");
}

function parse(): Route {
  if (serverUrl !== null) {
    const [p, q = ""] = serverUrl.split("?");
    return { path: p.split("/").filter(Boolean), query: new URLSearchParams(q) };
  }
  const p = appPath(window.location.pathname);
  return { path: p.split("/").filter(Boolean), query: new URLSearchParams(window.location.search) };
}

const NAV = "hh:navigate";

/** Go to an app path without a reload. */
export function navigate(path: string, replace = false) {
  const url = href(path);
  if (replace) history.replaceState(null, "", url); else history.pushState(null, "", url);
  window.dispatchEvent(new Event(NAV));
}

/** Rewrite a legacy hash URL (#/concepts/x) to its path, keeping links shared before the switch alive. */
function upgradeHash() {
  const h = window.location.hash;
  if (h.startsWith("#/")) navigate(h.slice(1), true);
}

function isInternal(a: HTMLAnchorElement, e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(BASE)) return false;
  // same page, different #anchor: let the browser scroll
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
  return true;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    upgradeHash();
    setRoute(parse());
    const on = () => { setRoute(parse()); window.scrollTo({ top: 0 }); };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !(a instanceof HTMLAnchorElement) || !isInternal(a, e)) return;
      e.preventDefault();
      const url = new URL(a.href, window.location.href);
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;
      history.pushState(null, "", url.pathname + url.search);
      on();
    };
    window.addEventListener("popstate", on);
    window.addEventListener(NAV, on);
    document.addEventListener("click", click);
    return () => { window.removeEventListener("popstate", on); window.removeEventListener(NAV, on); document.removeEventListener("click", click); };
  }, []);
  return route;
}
