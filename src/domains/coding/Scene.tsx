import type { RunState } from "../../engine/types";

const BADGE: Record<string, [string, string]> = {
  read: ["R", "info"], M: ["M", "warn"], "!": ["!", "danger"], leak: ["leaked", "danger"], "+": ["+", "good"],
};

/** A mini repo view: file tree with change markers, the branch, and a test bar. */
export function RepoScene({ S }: { S: RunState }) {
  const repo = S.repo ?? { files: {}, tests: { pass: 0, fail: 0 }, branch: "main" };
  const total = repo.tests.pass + repo.tests.fail || 1;
  const passPct = (repo.tests.pass / total) * 100;
  return (
    <div className="scene repo-scene">
      <div className="repo-head"><span className="repo-branch">⎇ {repo.branch}</span></div>
      <ul className="repo-files">
        {Object.entries(repo.files as Record<string, string>).map(([path, status]) => {
          const b = BADGE[status];
          const depth = path.split("/").length - 1;
          return (
            <li key={path} className={status === "!" || status === "leak" ? "bad" : status === "M" ? "mod" : ""}>
              <span className="repo-path" style={{ paddingLeft: depth * 10 }}>{path.split("/").pop()}</span>
              {b && <span className={"pill " + b[1]}>{b[0]}</span>}
            </li>
          );
        })}
      </ul>
      <div className="repo-tests" aria-label={`${repo.tests.pass} passing, ${repo.tests.fail} failing`}>
        <div className="bar"><span style={{ width: passPct + "%" }} /></div>
        <span>{repo.tests.pass} passing · {repo.tests.fail} failing</span>
      </div>
    </div>
  );
}
