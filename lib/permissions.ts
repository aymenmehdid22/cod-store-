export type AdminRole = "owner" | "manager" | "order_operator";

export const ALL_ROLES: AdminRole[] = ["owner", "manager", "order_operator"];
export const STAFF: AdminRole[] = ["owner", "manager"];

/** Mirrors the RLS / RPC rules in supabase/migrations/002. The database is the source of truth;
 *  this map only decides what the UI shows and which API routes answer 403 early. */
export const PERMISSIONS = {
  "orders.read": ALL_ROLES,
  "orders.update": ALL_ROLES,
  "orders.export": STAFF,
  "catalog.write": STAFF,
  "inventory.write": STAFF,
  "settings.write": STAFF,
  "tracking.write": ["owner"] as AdminRole[],
  "team.manage": ["owner"] as AdminRole[],
  "audit.read": ["owner"] as AdminRole[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  return !!role && PERMISSIONS[permission].includes(role);
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Propriétaire",
  manager: "Gestionnaire",
  order_operator: "Opérateur commandes",
};
