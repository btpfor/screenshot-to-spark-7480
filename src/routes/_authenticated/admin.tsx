import { createFileRoute, Link, Navigate, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Car, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, Wallet, X } from "lucide-react";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administration — GIE VIP BOK GUIS GUIS" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/admin/chauffeurs", label: "Chauffeurs", icon: Users },
  { to: "/admin/vehicules", label: "Véhicules", icon: Car },
  { to: "/admin/cotisations", label: "Finances & cotisations", icon: Wallet },
  { to: "/admin/utilisateurs", label: "Utilisateurs & rôles", icon: ShieldCheck },
] as const;

function AdminLayout() {
  const { loading, isStaff, user, roles } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;
  if (!isStaff) return <Navigate to="/espace" />;

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between p-5">
          <Logo />
          <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium opacity-80 transition hover:bg-sidebar-accent hover:opacity-100 data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary data-[status=active]:opacity-100">
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs">
          <div className="truncate font-semibold text-sidebar-accent-foreground">{user?.email}</div>
          <div className="opacity-70">{roles.filter((r) => r !== "chauffeur").map((r) => ROLE_LABELS[r]).join(", ")}</div>
          <button onClick={logout} className="mt-3 flex items-center gap-2 opacity-80 hover:opacity-100"><LogOut className="h-3.5 w-3.5" /> Déconnexion</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 items-center justify-between border-b bg-card px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></Button>
          <div className="hidden text-sm text-muted-foreground md:block">Espace administration</div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/espace">Mon espace membre</Link></Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
