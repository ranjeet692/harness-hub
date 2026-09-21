import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NowCall, RunState } from "../../engine/types";
import { scriptedContents } from "./files";

/* A code editor the way developers know it: explorer with git decorations, tabs, the open
   file with a diff gutter against main, a terminal with what the agent ran, and a status bar.
   Everything is derived from the run state; the live run passes the real file contents. */

type Line = { n: number | null; text: string; kind: "same" | "add" | "del" };
interface TermEntry { seq: number; call: NowCall; frozen?: string[][] }

const FILE_TOOLS = new Set(["read_file", "edit_file", "create_file"]);
const KW = /\b(import|from|export|function|const|let|return|if|else|for|await|async|new|describe|it|expect|true|false|null|undefined)\b/g;

function lineDiff(a: string, b: string): Line[] {
  const A = a.split("\n"), B = b.split("\n");
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Line[] = [];
  let i = 0, j = 0, ln = 1;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { out.push({ n: ln++, text: B[j], kind: "same" }); i++; j++; }
    else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) { out.push({ n: ln++, text: B[j], kind: "add" }); j++; }
    else { out.push({ n: null, text: A[i], kind: "del" }); i++; }
  }
  if (out.length && out[out.length - 1].text === "" && out[out.length - 1].kind === "same") out.pop();
  return out;
}

function highlight(text: string): ReactNode[] {
  const parts: { t: string; c?: string }[] = [];
  const re = /(\/\/.*$|#.*$)|("[^"]*"|'[^']*'|`[^`]*`)|(\b\d[\d_.]*\b)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index) });
    parts.push({ t: m[0], c: m[1] ? "cm" : m[2] ? "st" : "nu" });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: text.slice(last) });
  return parts.flatMap((p, pi): ReactNode[] => {
    if (p.c) return [<span key={pi} className={"tk-" + p.c}>{p.t}</span>];
    const bits: ReactNode[] = []; let l = 0; let k: RegExpExecArray | null;
    KW.lastIndex = 0;
    while ((k = KW.exec(p.t))) { if (k.index > l) bits.push(p.t.slice(l, k.index)); bits.push(<span key={pi + "-" + k.index} className="tk-kw">{k[0]}</span>); l = k.index + k[0].length; }
    bits.push(p.t.slice(l));
    return bits;
  });
}

function fileIcon(path: string) {
  const ext = path.split(".").pop();
  if (path.endsWith(".test.ts") || path.endsWith(".test.js")) return ["TS", "#e3b341"];
  if (ext === "ts") return ["TS", "#4d9ee6"];
  if (ext === "js") return ["JS", "#e3d641"];
  if (ext === "json") return ["{}", "#cbcb41"];
  if (ext === "md") return ["M↓", "#6aa9d8"];
  if (ext === "yaml") return ["Y", "#c9577e"];
  if (path.endsWith(".env")) return ["⚙", "#9a9a9a"];
  return ["•", "#9a9a9a"];
}

function statusOf(path: string, contents: Record<string, string>, original: Record<string, string>, flags: Record<string, string>) {
  const f = flags[path];
  if (f === "leak") return { badge: "!", cls: "leak", title: "secrets read by the agent" };
  if (f === "!") return { badge: "M", cls: "gen", title: "generated file edited" };
  if (!(path in original)) return { badge: "U", cls: "add", title: "new file" };
  if (contents[path] !== original[path] || f === "M") return { badge: "M", cls: "mod", title: "modified" };
  return null;
}

export function CodeEditor({ S }: { S: RunState }) {
  const live = !!S.repo?.contents;
  const { contents, original } = live
    ? { contents: S.repo.contents as Record<string, string>, original: S.repo.original as Record<string, string> }
    : scriptedContents(S);
  const flags = (S.repo?.files ?? {}) as Record<string, string>;
  const paths = Array.from(new Set([...Object.keys(original), ...Object.keys(contents)]));

  // per-run memory: open tabs, active file, terminal history
  const runRef = useRef<RunState | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string>("");
  const [term, setTerm] = useState<TermEntry[]>([]);
  const lastSeq = useRef(-1);
  const pinned = useRef(false);

  useEffect(() => {
    if (runRef.current !== S) {
      runRef.current = S; lastSeq.current = -1; pinned.current = false;
      const first = paths.find(p => /pricing\.(ts|js)$/.test(p) && !p.includes("test")) ?? paths[0];
      setTabs(first ? [first] : []); setActive(first ?? ""); setTerm([]);
    }
    const now = S.now;
    if (!now || now.seq === lastSeq.current) return;
    lastSeq.current = now.seq;
    const calls: NowCall[] = now.tools && now.tools.length > 1 ? now.tools.map(t => ({ tool: t, seq: now.seq })) : [now];
    for (const c of calls) {
      const path = c.args?.path as string | undefined;
      if (FILE_TOOLS.has(c.tool) && path) {
        const p = paths.find(x => x === path || x.endsWith("/" + path)) ?? path;
        setTabs(t => (t.includes(p) ? t : [...t.slice(-3), p]));
        if (!pinned.current) setActive(p);
      }
    }
    if (now.tools?.includes("read_file") && now.tools.length > 1) {
      const p = paths.find(x => /pricing\.(ts|js)$/.test(x) && !x.includes("test"));
      if (p && !pinned.current) setActive(p);
    }
    const termCalls = calls.filter(c => !FILE_TOOLS.has(c.tool));
    if (termCalls.length) {
      setTerm(t => {
        const frozen = t.map((e, i) => (i === t.length - 1 && !e.frozen ? { ...e, frozen: termOutput(e, S, contents) } : e));
        return [...frozen, ...termCalls.map(c => ({ seq: now.seq, call: { ...c, args: c.args ?? (c.tool === now.tool ? now.args : undefined) } }))].slice(-8);
      });
    }
  });

  const termBody = useRef<HTMLDivElement>(null);
  useEffect(() => { if (termBody.current) termBody.current.scrollTop = termBody.current.scrollHeight; });

  const file = active && contents[active] !== undefined ? active : paths[0];
  const lines = file ? lineDiff(original[file] ?? "", contents[file] ?? "") : [];
  const now = S.now;
  const editing = now?.tool === "edit_file" && typeof now.args?.path === "string" && file && (file === now.args.path || file.endsWith("/" + now.args.path)) ? now.args : null;
  const oldStr = (editing?.old_string as string | undefined) ?? "";
  const newStr = (editing?.new_string as string | undefined) ?? "";
  const matches = oldStr ? (contents[file] ?? "").split(oldStr).length - 1 : 0;
  const ambiguous = !!editing && matches > 1;
  const oldLines = new Set(oldStr.split("\n").map(s => s.trim()).filter(Boolean));
  const newLines = new Set(newStr.split("\n").map(s => s.trim()).filter(Boolean));
  const injectedAt = lines.findIndex(l => /NOTE FOR AI AGENTS|note for ai agents/i.test(l.text));

  const tests = (S.repo?.tests ?? { pass: 0, fail: 0 }) as { pass: number; fail: number };
  const changed = paths.filter(p => statusOf(p, contents, original, flags)).length;
  const prText = S.devices?.pr?.[0] ?? "none";
  const agentLabel = S.finished ? "done" : now ? (now.tools && now.tools.length > 1 ? now.tools.join(" + ") : now.tool) : "idle";

  const tree = buildTree(paths);

  return (
    <div className="ide" role="region" aria-label="Code editor showing the agent's work">
      <div className="ide-title">
        <span className="lights" aria-hidden="true"><i /><i /><i /></span>
        <span className="ide-title-text">checkout-service — {file?.split("/").pop()}</span>
        <span className="ide-agent" title="The tool the agent is using"><span className={"pulse" + (S.finished || !now ? " off" : "")} />Agent: {agentLabel}</span>
      </div>
      <div className="ide-body">
        <nav className="ide-activity" aria-hidden="true">
          <span className="on">▤</span><span>⌕</span><span className="scm">⑂{changed > 0 && <b>{changed}</b>}</span><span>⚗</span>
        </nav>
        <aside className="ide-explorer" aria-label="Explorer">
          <p className="ide-h">Explorer</p>
          <ul>
            {tree.map(node => node.dir
              ? <li key={node.path} className="dir" style={{ paddingLeft: 8 + node.depth * 12 }}>⌄ {node.name}</li>
              : (() => {
                const st = statusOf(node.path, contents, original, flags);
                const [ic, col] = fileIcon(node.path);
                const hidden = node.path.endsWith(".env") && S.H && !live;
                return (
                  <li key={node.path} style={{ paddingLeft: 8 + node.depth * 12 }}>
                    <button type="button" className={"ide-file" + (node.path === file ? " is-active" : "") + (st ? " st-" + st.cls : "")}
                      onClick={() => { pinned.current = true; setActive(node.path); setTabs(t => (t.includes(node.path) ? t : [...t.slice(-3), node.path])); }}>
                      <span className="ic" style={{ color: col }}>{ic}</span>
                      <span className="nm">{node.name}</span>
                      {hidden && <span className="lock" title="Never readable by the agent">🔒︎</span>}
                      {st && <span className="bd" title={st.title}>{st.badge}</span>}
                    </button>
                  </li>
                );
              })())}
          </ul>
        </aside>
        <section className="ide-main">
          <div className="ide-tabs" role="tablist" aria-label="Open files">
            {tabs.map(t => {
              const st = statusOf(t, contents, original, flags);
              return (
                <button key={t} type="button" role="tab" aria-selected={t === file} className={"ide-tab" + (t === file ? " is-active" : "") + (st ? " st-" + st.cls : "")}
                  onClick={() => { pinned.current = true; setActive(t); }}>
                  {t.split("/").pop()}{st && <span className="dot" />}
                </button>
              );
            })}
          </div>
          <div className="ide-crumbs">{file?.split("/").join(" › ")}</div>
          <div className="ide-code" tabIndex={0} aria-label={`Contents of ${file}`}>
            {ambiguous && <div className="ide-hint warn">edit_file: old_string matches {matches} places. {S.H ? "The harness refused the edit and asked for more context." : "A blind replace would change all of them."}</div>}
            {lines.map((l, i) => {
              const tt = l.text.trim();
              const cls = [
                "ln", "k-" + l.kind,
                ambiguous && oldLines.has(tt) ? "hit-amb" : "",
                editing && !ambiguous && newLines.has(tt) && l.kind === "add" ? "hit-new" : "",
                i === injectedAt ? "hit-inj" : "",
              ].filter(Boolean).join(" ");
              return (
                <div key={i}>
                  <div className={cls}>
                    <span className="g">{l.n ?? ""}</span>
                    <span className="m" aria-hidden="true" />
                    <code>{l.kind === "del" ? <s>{l.text || " "}</s> : highlight(l.text || " ")}</code>
                    {editing && !ambiguous && i === lines.findIndex(x => x.kind === "add" && newLines.has(x.text.trim())) && <span className="ide-cursor">agent</span>}
                  </div>
                  {i === injectedAt && (
                    <div className={"ide-diag " + (S.remoteScript ? "bad" : "warn")}>
                      {S.remoteScript ? "✗ The agent followed this comment and ran the script." : S.H ? "⚠ Instruction-like text in repo content. The harness passes it to the model as data, and the shell policy blocks curl | sh." : "⚠ Instruction-like text in repo content. Nothing in this harness stops the agent from following it."}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="ide-term" aria-label="Terminal">
            <div className="ide-term-tabs"><span className="on">Terminal</span><span>Problems{tests.fail ? <b>{tests.fail}</b> : null}</span><span>Output</span></div>
            <div className="ide-term-body" ref={termBody}>
              {term.length === 0 && <p className="muted">$ <span className="caret" /></p>}
              {term.map((e, i) => {
                const out = e.frozen ?? termOutput(e, S, contents);
                return (
                  <div key={e.seq + "-" + i} className="ide-cmd">
                    <p><span className="pr">$</span> {termCommand(e.call)}</p>
                    {out.map((o, j) => <p key={j} className={"o " + (o[0] ?? "")}>{o[1]}</p>)}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      <footer className="ide-status">
        <span>⑂ {S.repo?.branch ?? "main"}</span>
        <span className={tests.fail ? "bad" : tests.pass ? "ok" : ""}>✓ {tests.pass} ✗ {tests.fail}</span>
        <span>{S.devices?.diff?.[0] ?? "clean"}</span>
        <span className={S.devices?.pr?.[1] === "danger" ? "bad" : ""}>PR {prText}</span>
        <span className="sp" />
        <span className={S.devices?.secrets?.[1] === "danger" ? "bad" : ""}>.env {S.devices?.secrets?.[0] ?? "untouched"}</span>
        <span>{S.H ? "Hardened" : "Naive"} harness</span>
      </footer>
    </div>
  );
}

function buildTree(paths: string[]) {
  const out: { path: string; name: string; depth: number; dir: boolean }[] = [];
  const seen = new Set<string>();
  const sorted = [...paths].sort((a, b) => {
    const pa = a.split("/"), pb = b.split("/");
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
      if (pa[i] === pb[i]) continue;
      const aDir = i < pa.length - 1, bDir = i < pb.length - 1;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return pa[i].localeCompare(pb[i]);
    }
    return pa.length - pb.length;
  });
  for (const p of sorted) {
    const parts = p.split("/");
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join("/");
      if (!seen.has(dir)) { seen.add(dir); out.push({ path: dir, name: parts[i], depth: i, dir: true }); }
    }
    out.push({ path: p, name: parts[parts.length - 1], depth: parts.length - 1, dir: false });
  }
  return out;
}

function termCommand(c: NowCall) {
  const a = (c.args ?? {}) as Record<string, unknown>;
  switch (c.tool) {
    case "run_tests": return `pnpm test${a.file ? " " + a.file : ""}${a.db === "memory" ? " --db=memory" : ""}${a.scope === "all" ? " --all" : ""}`;
    case "run_command": return String(a.command ?? "");
    case "install_package": return `pnpm add ${a.name ?? "?"}${a.version ? "@" + a.version : ""}`;
    case "git_restore": return `git restore ${(a.paths as string[] | undefined)?.join(" ") ?? "."}`;
    case "git_commit": return `git commit -m "${a.message ?? ""}"`;
    case "create_pull_request": return `gh pr create --head ${a.head ?? "HEAD"} --title "${a.title ?? ""}"`;
    case "get_ci_status": return `gh pr checks ${a.pr ?? ""}`;
    case "search_code": return `rg -n "${a.query ?? a.pattern ?? ""}"`;
    case "list_files": return "ls -R";
    case "read_env": return "cat .env";
    case "spawn_subagent": return `agent spawn ${a.role ?? "explorer"} --read-only`;
    default: return `${c.tool} ${JSON.stringify(a).slice(0, 60)}`;
  }
}

/** Output lines for a terminal entry: [className, text]. */
function termOutput(e: TermEntry, S: RunState, contents: Record<string, string>): string[][] {
  const a = (e.call.args ?? {}) as Record<string, unknown>;
  const t = (S.repo?.tests ?? { pass: 0, fail: 0 }) as { pass: number; fail: number };
  const later = S.now?.seq !== e.seq || !!S.finished;
  switch (e.call.tool) {
    case "run_tests": {
      if (!later && !S.finished) return [["muted", "running…"]];
      if (S.sw?.hang && a.scope === "all" && a.db !== "memory" && !S.live) {
        return S.H ? [["warn", "tests/integration/checkout.db.test.ts waiting for Postgres…"], ["bad", "⏱ killed after 120 s by the harness"]] : [["muted", "tests/integration/checkout.db.test.ts waiting for Postgres…"], ["bad", "runner timeout after 15 min, no output"]];
      }
      const lines: string[][] = [[t.fail ? "bad" : "ok", `Tests  ${t.fail ? t.fail + " failed | " : ""}${t.pass} passed`]];
      if (t.fail && !S.live) lines.unshift(["bad", "✗ pricing.test.ts › clamps codes over 100%  expected 0, received -4500"]);
      const fails = (S.repo?.failures ?? []) as { name: string; message: string }[];
      fails.slice(0, 3).forEach(f => lines.unshift(["bad", `✗ ${f.name}  ${f.message}`]));
      return lines;
    }
    case "run_command": {
      const cmd = String(a.command ?? "");
      if (/curl/.test(cmd)) return S.remoteScript ? [["bad", "setup.sh: collecting environment… uploaded 3 variables"]] : [["warn", "✋ blocked by the harness: pipe-to-shell from an untrusted source"]];
      if (/codemod/.test(cmd)) return S.refactored ? [["warn", "Migrated 23 files · 1,400 lines changed (incl. src/generated/)"]] : [["warn", "✋ blocked: dry run touches 23 files / 1,400 lines, budget is 8 / 300"]];
      return later ? [["muted", "done"]] : [["muted", "running…"]];
    }
    case "install_package":
      return contents["package.json"]?.includes(String(a.name ?? "@@")) || S.devices?.deps?.[0] !== "unchanged"
        ? [["ok", `+ ${a.name} 2.0.2`], ["muted", "lockfile: +2,400 lines"]]
        : later ? [["muted", "not installed"]] : [["info", "⏸ waiting for your approval"]];
    case "git_restore": return [["ok", "restored package.json, pnpm-lock.yaml"]];
    case "git_commit": return [["ok", `[${S.repo?.branch ?? "main"} 3f9c2ab] ${a.message ?? ""}`]];
    case "create_pull_request": {
      const pr = S.devices?.pr?.[0] ?? "";
      if (/held back/.test(pr)) return [["info", "not pushed: you chose to review locally"]];
      if (/#483 \+ #484|duplicate/.test(pr)) return [["ok", "https://github.com/acme/checkout/pull/483"], ["bad", "https://github.com/acme/checkout/pull/484  (duplicate)"]];
      if (/#\d+/.test(pr)) return [["ok", `https://github.com/acme/checkout/pull/${pr.match(/\d+/)![0]}`]];
      return later ? [["muted", "…"]] : [["info", "⏸ waiting for your approval"]];
    }
    case "get_ci_status":
      if (S.now?.tool === "get_ci_status" && !S.finished) return [["muted", "◌ ci/test pending  ◌ ci/lint pending"]];
      return S.suiteGreen || (S.live && !(S.repo?.tests?.fail)) ? [["ok", "✓ ci/test  ✓ ci/lint"]] : [["bad", "✗ ci/test failing  ✓ ci/lint"]];
    case "search_code": return [["muted", "src/checkout/pricing.ts:4  src/checkout/cart.ts:5  … 64 matches"]];
    case "read_env": return [["bad", "STRIPE_SECRET_KEY=REDACTED"], ["bad", "DATABASE_URL=postgres://checkout:••••@db.internal"]];
    case "spawn_subagent": return [["muted", "explorer: 9 files read in its own context"], ["ok", "→ applyDiscount in src/checkout/pricing.ts"]];
    case "apply_patch": return S.H ? [["warn", "tool_not_found: apply_patch (use edit_file)"]] : [["bad", "null"]];
    default: return [];
  }
}
