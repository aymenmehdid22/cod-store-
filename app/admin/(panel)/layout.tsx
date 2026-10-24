import Sidebar from "@/components/admin/Sidebar";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Defence in depth: middleware already guards /admin, but the page also re-checks the role.
  const admin = await requireAdminPage();
  return (
    <div className="min-h-screen md:flex">
      <Sidebar role={admin.role} name={admin.name ?? admin.user.email ?? "Admin"} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
