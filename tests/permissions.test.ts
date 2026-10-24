import { describe, expect, it } from "vitest";
import { can, PERMISSIONS } from "@/lib/permissions";

describe("role permissions", () => {
  it("order operators can work orders but not export, edit the catalogue or see tracking/team/audit", () => {
    expect(can("order_operator", "orders.update")).toBe(true);
    for (const p of ["orders.export", "catalog.write", "inventory.write", "settings.write", "tracking.write", "team.manage", "audit.read"] as const) expect(can("order_operator", p)).toBe(false);
  });
  it("managers run the shop but cannot touch tracking, team or audit", () => {
    expect(can("manager", "catalog.write")).toBe(true);
    expect(can("manager", "orders.export")).toBe(true);
    for (const p of ["tracking.write", "team.manage", "audit.read"] as const) expect(can("manager", p)).toBe(false);
  });
  it("owners can do everything", () => { for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can("owner", p)).toBe(true); });
  it("no role (anonymous / non-admin) can do anything", () => { for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) { expect(can(null, p)).toBe(false); expect(can(undefined, p)).toBe(false); } });
});
