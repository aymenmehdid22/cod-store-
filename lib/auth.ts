import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { can, type AdminRole, type Permission } from "@/lib/permissions";

export type Admin = { user: User; role: AdminRole; name: string | null };

/** The signed-in user IF they exist in public.admin_users. A valid Supabase session alone is NOT admin access
 *  (public sign-ups exist). Roles are read from the table, never from user metadata. */
export async function getAdmin(): Promise<Admin | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("admin_users")
    .select("role, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return { user, role: data.role as AdminRole, name: data.display_name };
}

/** For Server Components / pages. */
export async function requireAdminPage(permission?: Permission): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login?error=forbidden");
  if (permission && !can(admin.role, permission)) redirect("/admin?error=forbidden");
  return admin;
}

type ApiOk = { ok: true; admin: Admin; supabase: SupabaseClient };
type ApiFail = { ok: false; res: NextResponse };

/** For route handlers. Returns a user-session client: every query is still filtered by RLS. */
export async function requireAdminApi(permission?: Permission): Promise<ApiOk | ApiFail> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (permission && !can(admin.role, permission)) {
    return { ok: false, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, admin, supabase: createClient() as unknown as SupabaseClient };
}

/** Maps database exceptions raised by our RPCs to safe HTTP responses. */
export function rpcError(error: { message?: string; code?: string } | null): NextResponse {
  const msg = error?.message ?? "";
  if (error?.code === "42501" || msg.includes("FORBIDDEN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (msg.includes("INVALID_TRANSITION")) return NextResponse.json({ error: "Transition de statut non autorisée." }, { status: 409 });
  if (msg.includes("NOT_FOUND")) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (msg.includes("INSUFFICIENT_STOCK")) return NextResponse.json({ error: "Stock insuffisant ou article introuvable." }, { status: 409 });
  if (error?.code === "23505") return NextResponse.json({ error: "Cette valeur existe déjà (slug, SKU ou code).", detail: "unique" }, { status: 409 });
  if (error?.code === "23503") return NextResponse.json({ error: "Suppression impossible : des éléments y sont rattachés." }, { status: 409 });
  if (error?.code === "23514") return NextResponse.json({ error: "Valeur invalide (contrainte de validation)." }, { status: 400 });
  console.error("RPC/DB error:", error);
  return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
}
