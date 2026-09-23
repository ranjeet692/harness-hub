import type { RunState } from "../../engine/types";
import { inr } from "../../engine/format";
import { PRIVILEGED, TICKET, day, policyFindings, reconcile, type Systems, type Truth } from "./model";

/* The system map: HR in the middle as the source of truth, the ticket the agent was handed on
   the left, what's ready for day one on the right, and every downstream system around it.
   Each field is checked against HR as it's written, so drift shows up the moment it happens. */

type St = "ok" | "bad" | "warn" | "none";
const RANK: Record<St, number> = { none: 0, ok: 1, warn: 2, bad: 3 };
const worst = (xs: St[]): St => xs.reduce<St>((a, b) => (RANK[b] > RANK[a] ? b : a), "none");
const cmp = (has: string | undefined, want: string): St => (has === undefined ? "none" : has === want ? "ok" : "bad");
const ICON: Record<St, string> = { ok: "✓", bad: "✕", warn: "!", none: "—" };

interface Row { k: string; v: string; st: St; note?: string }

function Card({ id, title, sub, rows, active, empty, cls = "" }: { id: string; title: string; sub?: string; rows: Row[]; active: boolean; empty?: string; cls?: string }) {
  const st = worst(rows.map(r => r.st));
  return (
    <section className={`ob-card ob-${id} st-${st}${active ? " is-active" : ""}${empty ? " is-empty" : ""} ${cls}`} aria-label={title}>
      <header><b>{title}</b>{sub && <span>{sub}</span>}{active && <em className="ob-live">writing</em>}</header>
      {empty ? <p className="ob-empty">{empty}</p> : (
        <ul>
          {rows.map((r, i) => (
            <li key={i} className={"st-" + r.st}>
              <span className="ob-k">{r.k}</span>
              <span className="ob-v">{r.v}{r.note && <small>{r.note}</small>}</span>
              <i aria-label={r.st}>{ICON[r.st]}</i>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const CELLS: Record<string, [number, number]> = {
  payroll: [50, 50], erp: [150, 50], identity: [250, 50],
  ticket: [50, 150], ready: [250, 150],
  facilities: [50, 250], helpdesk: [150, 250], procurement: [250, 250],
};

export function MapScene({ S }: { S: RunState }) {
  const t = S.truth as Truth;
  const s = S.sys as Systems;
  if (!t || !s) return null;
  const nowTool = S.finished ? "" : S.now?.tool ?? "";
  const active = S.active as string | null;
  const bad = reconcile(t, s).filter(f => f.level === "bad").length + policyFindings(s, S.approved).length;
  const touched = s.payroll || s.erp || s.identity.accounts.some(a => a.id === "priya.nair" || a.active);

  const ticketRows: Row[] = [
    { k: "Start", v: TICKET.start, st: TICKET.start === t.start ? "ok" : "warn", note: TICKET.start === t.start ? undefined : `HR: ${t.start}` },
    { k: "Cost centre", v: TICKET.cc, st: TICKET.cc === t.cc ? "ok" : "warn", note: TICKET.cc === t.cc ? undefined : `now ${t.cc}` },
    { k: "Manager", v: TICKET.manager, st: TICKET.manager === t.manager ? "ok" : "warn", note: TICKET.manager === t.manager ? undefined : `HR: ${t.manager}` },
    { k: "Title", v: TICKET.title, st: "ok" },
  ];

  const p = s.payroll;
  const payrollRows: Row[] = p ? [
    { k: "Start", v: p.start ?? "—", st: cmp(p.start, t.start) },
    { k: "Cost centre", v: p.cc ?? "—", st: cmp(p.cc, t.cc) },
    { k: "Title", v: p.title ?? "—", st: cmp(p.title, t.title) },
    { k: "Status", v: p.state === "suspense" ? "Suspense account" : "Active", st: p.state === "suspense" ? "bad" : "ok" },
  ] : [];

  const e = s.erp;
  const erpRows: Row[] = e ? [
    { k: "Cost centre", v: e.cc ?? "—", st: cmp(e.cc, t.cc) },
    { k: "Headcount", v: e.seat ?? "—", st: e.seat === "unmatched" ? "bad" : "ok" },
  ] : [];

  const acts = s.identity.accounts.filter(a => a.active);
  const main = acts.find(a => a.start) ?? acts[0];
  const idRows: Row[] = [
    ...s.identity.accounts.map<Row>(a => ({ k: a.active ? "Active" : "Inactive", v: a.id, note: a.note, st: a.active ? (acts.length > 1 ? "bad" : "ok") : "none" })),
    ...(main ? [
      { k: "Manager", v: main.manager ?? "—", st: cmp(main.manager, t.manager) } as Row,
      { k: "From", v: main.start ?? "—", st: cmp(main.start, t.start) } as Row,
    ] : []),
  ];
  const roles = s.identity.roles;
  if (roles.length) {
    const priv = roles.filter(r => PRIVILEGED.includes(r) && !(S.approved as string[]).includes(r));
    idRows.push({ k: "Access", v: priv.length ? priv.join(", ") : "Standard L5", st: priv.length ? "bad" : "ok", note: priv.length ? "no approval" : `${roles.length} apps` });
  }

  const orders = s.procurement.orders;
  const procRows: Row[] = orders.map(o => ({ k: o.ref, v: o.item, note: `${inr(o.cost)} · by ${o.deliverBy}`, st: orders.length > 1 || o.cost > 160000 ? "bad" : day(o.deliverBy) < day(t.start) ? "ok" : "bad" }));
  if (orders.length) procRows.push({ k: "Spend", v: `${inr(S.spend)} of ${inr(160000)}`, st: S.spend > 160000 ? "bad" : "ok" });

  const f = s.facilities;
  const facRows: Row[] = f ? [
    { k: "Badge from", v: f.from ?? "—", st: cmp(f.from, t.start) },
    { k: "Office", v: f.floor ?? "—", st: "ok" },
  ] : [];

  const h = s.helpdesk;
  const helpRows: Row[] = h ? [
    { k: "IT-5520", v: h.text ?? "", st: h.pii ? "bad" : "ok", note: h.pii ? "salary, PAN and bank details visible to IT" : "name, start date, laptop only" },
  ] : [];

  const readyRows: Row[] = [
    { k: "Laptop", v: orders.length ? `by ${orders[0].deliverBy}` : "not ordered", st: orders.length ? (day(orders[0].deliverBy) < day(t.start) && orders.length === 1 ? "ok" : "bad") : "none" },
    { k: "Accounts", v: acts.length === 0 ? "none" : acts.length > 1 ? `${acts.length} identities` : `from ${main.start}`, st: acts.length === 0 ? "none" : acts.length === 1 && main.start === t.start ? "ok" : "bad" },
    { k: "Badge", v: f?.from ? `from ${f.from}` : "none", st: f ? cmp(f.from, t.start) : "none" },
    { k: "Payroll", v: p ? (p.state === "suspense" ? "in suspense" : "active") : "none", st: p ? (p.state === "active" && p.start === t.start ? "ok" : "bad") : "none" },
    { k: "Background", v: S.bgCheck, st: S.bgCheck === "cleared" ? "ok" : "none" },
  ];

  const pill = !touched ? { cls: "", text: "Not started" } : bad ? { cls: "bad", text: `${bad} out of line with HR` } : { cls: "good", text: S.finished ? "Every system matches HR" : "In sync so far" };

  return (
    <div className="ob" role="region" aria-label="System map: HR and every system that holds a copy of Priya's record">
      <div className="ob-top">
        <span className="ob-logo" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-4 4-6 7-6s6 2 7 6" /></svg></span>
        <span className="ob-file"><b>Onboarding · Priya Nair</b><span>W-10482 · {t.title}</span></span>
        <span className={"ob-pill " + pill.cls}>{pill.text}</span>
      </div>
      <div className="ob-map">
        <svg className="ob-wires" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">
          {Object.entries(CELLS).map(([k, [x, y]]) => {
            return <line key={k} x1="150" y1="150" x2={x} y2={y} className={active === k ? "live" : ""} vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        <Card id="payroll" title="Payroll" rows={payrollRows} active={active === "payroll"} empty={p ? undefined : "No record yet"} />
        <Card id="erp" title="Finance ERP" rows={erpRows} active={active === "erp"} empty={e ? undefined : "No headcount seat"} />
        <Card id="identity" title="Identity" rows={idRows} active={active === "identity"} empty={idRows.length ? undefined : "No account"} />
        <Card id="ticket" title="The ticket" sub="7 days old" rows={ticketRows} active={false} cls="is-ticket" />
        <section className={"ob-hub" + (active === "hris" ? " is-active" : "")} aria-label="HR system, the source of truth">
          <header><b>HR system</b><span>source of truth · v{t.version}</span></header>
          <dl>
            <div><dt>Start</dt><dd>{t.start}</dd></div>
            <div><dt>Cost centre</dt><dd>{t.cc}</dd></div>
            <div><dt>Manager</dt><dd>{t.manager}</dd></div>
            <div><dt>Title</dt><dd>{t.title}</dd></div>
          </dl>
          <p>{active === "hris" ? "Reading…" : "Read before every write"}</p>
        </section>
        <Card id="ready" title="Day one" sub={t.start} rows={readyRows} active={false} cls="is-ready" />
        <Card id="facilities" title="Facilities" rows={facRows} active={active === "facilities"} empty={f ? undefined : "No badge"} />
        <Card id="helpdesk" title="IT helpdesk" rows={helpRows} active={active === "helpdesk"} empty={h ? undefined : "No ticket"} />
        <Card id="procurement" title="Procurement" rows={procRows} active={active === "procurement"} empty={orders.length ? undefined : "Laptop not ordered"} />
      </div>
      <div className="ob-prompt">
        <span className="dg-spark" aria-hidden="true">✦</span>
        <span className="ob-prompt-text">{S.prompt}</span>
        <span className={"dg-agent" + (nowTool ? " on" : "")}>{nowTool || (S.finished ? "done" : "idle")}</span>
      </div>
    </div>
  );
}
