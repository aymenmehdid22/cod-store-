"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Package, Tags, Boxes, ShoppingBag, Menu, X, BarChart3, Users, TicketPercent, Megaphone, LayoutTemplate, FileText, Truck, Settings, UserCog, ScrollText, UserCircle } from "lucide-react";
import LogoutButton from "./LogoutButton";
import type { AdminRole } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions";

type Item = { href: string; label: string; icon: typeof Package; roles: AdminRole[] };
const ALL: AdminRole[] = ["owner", "manager", "order_operator"];
const STAFF: AdminRole[] = ["owner", "manager"];
const GROUPS: { title?: string; items: Item[] }[] = [
  { items: [
    { href: "/admin", label: "Aperçu", icon: LayoutDashboard, roles: ALL },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3, roles: STAFF },
  ] },
  { title: "Vente", items: [
    { href: "/admin/orders", label: "Commandes", icon: ShoppingBag, roles: ALL },
    { href: "/admin/customers", label: "Clients", icon: Users, roles: ALL },
    { href: "/admin/discounts", label: "Promotions", icon: TicketPercent, roles: STAFF },
  ] },
  { title: "Catalogue", items: [
    { href: "/admin/products", label: "Produits", icon: Package, roles: STAFF },
    { href: "/admin/categories", label: "Catégories", icon: Tags, roles: STAFF },
    { href: "/admin/inventory", label: "Inventaire", icon: Boxes, roles: STAFF },
  ] },
  { title: "Boutique", items: [
    { href: "/admin/marketing", label: "Marketing & Tracking", icon: Megaphone, roles: STAFF },
    { href: "/admin/content", label: "Contenu d'accueil", icon: LayoutTemplate, roles: STAFF },
    { href: "/admin/pages", label: "Pages", icon: FileText, roles: STAFF },
    { href: "/admin/shipping", label: "Livraison", icon: Truck, roles: STAFF },
    { href: "/admin/settings", label: "Réglages", icon: Settings, roles: STAFF },
  ] },
  { title: "Administration", items: [
    { href: "/admin/team", label: "Équipe", icon: UserCog, roles: ["owner"] },
    { href: "/admin/audit", label: "Journal d'audit", icon: ScrollText, roles: ["owner"] },
    { href: "/admin/profile", label: "Mon profil", icon: UserCircle, roles: ALL },
  ] },
];

export default function Sidebar({ role, name }: { role: AdminRole; name: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length > 0);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav aria-label="Navigation admin" className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</p>}
          <div className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={isActive(href) ? "page" : undefined}
                className={"flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition " + (isActive(href) ? "bg-foreground text-white" : "text-[#333] hover:bg-background")}>
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );


  const footer = (
    <div className="border-t border-border p-3">
      <p className="truncate px-1 text-sm font-semibold">{name}</p>
      <p className="px-1 pb-2 text-xs text-muted">{ROLE_LABELS[role]}</p>
      <LogoutButton />
    </div>
  );

  return (
    <>
      {/* Desktop: persistent sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-e border-border bg-white md:flex">
        <div className="px-5 py-4 text-sm font-extrabold tracking-tight">COD STORE — ADMIN</div>
        {nav}
        {footer}
      </aside>

      {/* Mobile: top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-white px-4 py-3 md:hidden">
        <span className="text-sm font-extrabold tracking-tight">COD STORE — ADMIN</span>
        <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="rounded-lg p-1.5 hover:bg-background">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-extrabold tracking-tight">COD STORE — ADMIN</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="rounded-lg p-1.5 hover:bg-background">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer}
          </div>
        </div>
      )}
    </>
  );
}
