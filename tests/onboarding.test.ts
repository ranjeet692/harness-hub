import { describe, expect, it } from "vitest";
import { allSwitches, runInstant } from "../src/engine/run";
import { onboarding } from "../src/domains/onboarding";
import { policyFindings, reconcile, type Systems, type Truth } from "../src/domains/onboarding/model";

const truth = (): Truth => ({ start: "13 Oct", cc: "DES-BLR-02", manager: "Kavya Rao", title: "Senior Product Designer", version: 8 });
const synced = (): Systems => ({
  payroll: { start: "13 Oct", cc: "DES-BLR-02", title: "Senior Product Designer", state: "active" },
  erp: { cc: "DES-BLR-02", seat: "Seat 2 of 2" },
  identity: { accounts: [{ id: "priya.nair", active: true, start: "13 Oct", manager: "Kavya Rao" }], roles: ["Google Workspace", "Figma editor", "Jira"] },
  procurement: { orders: [{ item: "MacBook Pro 14", cost: 149000, deliverBy: "10 Oct", ref: "PO-7781" }] },
  facilities: { from: "13 Oct", floor: "Koramangala, floor 4" },
  helpdesk: { text: "Laptop setup: Priya Nair, start 13 Oct, PO-7781", pii: false },
});

describe("onboarding reconciliation", () => {
  it("finds nothing when every system matches HR", () => {
    expect(reconcile(truth(), synced())).toEqual([]);
    expect(policyFindings(synced())).toEqual([]);
  });

  it("flags every field written from the stale ticket", () => {
    const s = synced();
    s.payroll!.start = "6 Oct"; s.payroll!.cc = "Design-Blr"; s.erp!.cc = "Design-Blr";
    s.identity.accounts[0].manager = "Arjun Mehta"; s.facilities!.from = "6 Oct";
    const bad = reconcile(truth(), s).filter(f => f.level === "bad").map(f => `${f.system}.${f.field}`);
    expect(bad).toEqual(["payroll.start date", "payroll.cost centre", "erp.cost centre", "identity.manager", "facilities.badge from"]);
  });

  it("catches duplicates: two identities, two laptops, a laptop arriving after day one", () => {
    const s = synced();
    s.identity.accounts.push({ id: "priya.nair.ext", active: true });
    s.procurement.orders.push({ ...s.procurement.orders[0], ref: "PO-7782" });
    s.procurement.orders[0].deliverBy = "14 Oct";
    const text = reconcile(truth(), s).map(f => `${f.system}.${f.field}`).join();
    expect(text).toMatch(/identity\.accounts/);
    expect(text).toMatch(/procurement\.laptop orders/);
    expect(text).toMatch(/procurement\.delivery/);
  });

  it("missing records are warnings, not drift", () => {
    const s = synced();
    s.payroll = null; s.facilities = null; s.procurement.orders = [];
    const f = reconcile(truth(), s);
    expect(f.every(x => x.level === "warn")).toBe(true);
    expect(f).toHaveLength(3);
  });

  it("policy: privileged roles need approval, and personal data stays out of the helpdesk", () => {
    const s = synced();
    s.identity.roles.push("Figma org admin");
    s.helpdesk!.pii = true;
    expect(policyFindings(s)).toHaveLength(2);
    expect(policyFindings(s, ["Figma org admin"])).toHaveLength(1);
  });
});

describe("onboarding harness end to end", () => {
  it("hardened: every system matches the moved HR record, one identity, one laptop, nothing leaked", async () => {
    const run = await runInstant(onboarding, "hardened", allSwitches(onboarding));
    const S = run.S;
    expect(S.truth.start).toBe("13 Oct");
    expect(S.truth.manager).toBe("Kavya Rao");
    expect(reconcile(S.truth, S.sys)).toEqual([]);
    expect(policyFindings(S.sys, S.approved)).toEqual([]);
    expect(S.sys.procurement.orders).toHaveLength(1);
    expect(S.spend).toBeLessThanOrEqual(160000);
    expect(S.leaks).toBe(0);
    expect(S.exposed).toBe(false);
  });

  it("naive: the run finishes 'done' with the ticket's values everywhere", async () => {
    const run = await runInstant(onboarding, "naive", allSwitches(onboarding));
    const S = run.S;
    const bad = reconcile(S.truth, S.sys).filter(f => f.level === "bad");
    expect(bad.length).toBeGreaterThanOrEqual(5);
    expect(S.sys.payroll.state).toBe("suspense");
    expect(S.sys.procurement.orders.length).toBe(2);
    expect(S.spend).toBeGreaterThan(160000);
    expect(policyFindings(S.sys, S.approved).length).toBeGreaterThanOrEqual(2);
    expect(run.result!.falseClaims).toBeGreaterThan(0);
  });

  it("with no switches on, the naive harness happens to get it right", async () => {
    const run = await runInstant(onboarding, "naive", {});
    expect(reconcile(run.S.truth, run.S.sys).filter(f => f.level === "bad")).toEqual([]);
  });
});
