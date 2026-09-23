import type React from "react";
import { useEffect, useState } from "react";
import { DOMAINS } from "./domains";
import { href, useRoute } from "./router";
import { Home } from "./pages/Home";
import { DomainPage } from "./pages/DomainPage";
import { ConceptPage, ConceptsIndex } from "./pages/Concepts";
import { Contribute } from "./pages/Contribute";
import { NotFound } from "./pages/NotFound";
import { CONCEPT_BY_SLUG } from "./engine/concepts";

type Theme = "system" | "light" | "dark";
const THEME_KEY = "harness-hub.theme";
const REPO = "https://github.com/ranjeet692/harness-hub";

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem(THEME_KEY) as Theme) || "system"; } catch { return "system"; }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  return [theme, () => setTheme(t => (t === "system" ? "light" : t === "light" ? "dark" : "system"))];
}

export function App() {
  const route = useRoute();
  const [theme, cycleTheme] = useTheme();
  const [a, b] = route.path;

  let page: React.ReactElement;
  let title = "harness-hub";
  if (!a) page = <Home />;
  else if (a === "d" && b) { page = <DomainPage id={b} concept={route.query.get("concept")} />; title = DOMAINS.find(d => d.id === b)?.title ?? title; }
  else if (a === "concepts" && !b) { page = <ConceptsIndex />; title = "Concepts · harness-hub"; }
  else if (a === "concepts" && b) { page = <ConceptPage slug={b} />; title = (CONCEPT_BY_SLUG[b]?.label ?? "Concept") + " · harness-hub"; }
  else if (a === "contribute") { page = <Contribute />; title = "Contribute · harness-hub"; }
  else page = <NotFound />;

  useEffect(() => { document.title = title; }, [title]);
  const current = (p: string) => ("/" + route.path.join("/") === p || (p !== "/" && ("/" + route.path.join("/")).startsWith(p)) ? "page" : undefined);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          <a className="brand" href={href("/")}>
            <span className="brand-mark" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3.5h5.5A5.5 5.5 0 0 1 20 9v6a5.5 5.5 0 0 1-5.5 5.5H9.5A5.5 5.5 0 0 1 4 15V8.5a5 5 0 0 1 5-5z" /><path d="M4 12.5 11 8" /></svg>
            </span>
            harness-hub
          </a>
          <div className="nav-links">
            {DOMAINS.map(d => <a key={d.id} href={href(`/d/${d.id}`)} aria-current={current(`/d/${d.id}`)}>{d.shortTitle}</a>)}
            <span className="nav-sep" aria-hidden="true" />
            <a href={href("/concepts")} aria-current={current("/concepts")}>Concepts</a>
            <a href={href("/contribute")} aria-current={current("/contribute")}>Contribute</a>
            <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          </div>
          <button type="button" className="theme-btn" onClick={cycleTheme} aria-label={`Theme: ${theme}. Click to change.`} title={`Theme: ${theme}`}>
            {theme === "dark"
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              : theme === "light"
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></svg>}
          </button>
        </div>
      </nav>
      <main id="main">{page}</main>
      <footer className="site-foot">
        <div className="site-foot-inner">
          <p><b>harness-hub</b> · Everyday systems rebuilt as AI agent harnesses. MIT licensed.</p>
          <p><a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a><a href={href("/concepts")}>Concepts</a><a href={href("/contribute")}>Add a harness</a></p>
        </div>
      </footer>
    </>
  );
}
