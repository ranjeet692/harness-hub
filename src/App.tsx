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
              <svg width="16" height="16" viewBox="0 0 64 64"><path d="M14 20h36M14 32h36M14 44h36" stroke="var(--on-brass)" strokeWidth="6" strokeLinecap="round" /></svg>
            </span>
            harness-hub
          </a>
          <div className="nav-links">
            {DOMAINS.map(d => <a key={d.id} href={href(`/d/${d.id}`)} aria-current={current(`/d/${d.id}`)}>{d.shortTitle}</a>)}
            <a href={href("/concepts")} aria-current={current("/concepts")}>Concepts</a>
            <a href={href("/contribute")} aria-current={current("/contribute")}>Contribute</a>
            <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          </div>
          <button type="button" className="theme-btn" onClick={cycleTheme} aria-label={`Theme: ${theme}. Click to change.`}>
            {theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark"}
          </button>
        </div>
      </nav>
      <main id="main">{page}</main>
      <footer className="site-foot">
        <div className="site-foot-inner">
          <span>harness-hub: everyday systems rebuilt as AI agent harnesses. MIT licensed.</span>
          <span><a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a> · <a href={href("/contribute")}>Add a domain</a></span>
        </div>
      </footer>
    </>
  );
}
