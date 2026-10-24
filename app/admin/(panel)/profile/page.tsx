import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import PasswordForm from "@/components/admin/PasswordForm";
import LogoutButton from "@/components/admin/LogoutButton";
import { ROLE_LABELS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const a = await requireAdminPage();
  return (
    <div className="max-w-md space-y-4">
      <PageHeader title="Mon profil" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Profil" }]} />
      <section className="card space-y-1 p-5 text-sm"><p className="font-semibold">{a.name ?? a.user.email}</p><p className="text-muted" dir="ltr">{a.user.email}</p><p className="text-muted">Rôle : {ROLE_LABELS[a.role]}</p></section>
      <section className="card p-5"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Mot de passe</h2><PasswordForm /></section>
      <section className="card p-5"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">Session</h2><LogoutButton /></section>
    </div>
  );
}
