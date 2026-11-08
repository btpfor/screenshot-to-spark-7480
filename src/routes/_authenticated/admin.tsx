import { createFileRoute, Link, Navigate, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Inbox, KeyRound, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, X, Quote } from "lucide-react";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/InstallApp";
import { canEditPresident } from "@/lib/president-rules";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administration — GIE VIP BOK GUIS GUIS" },
    { name: "description", content: "Espace sécurisé des responsables du GIE." },
    { property: "og:title", content: "Administration — GIE VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Administration des activités du GIE." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/admin/membres", label: "Gestion des membres", icon: Users },
  { to: "/admin/utilisateurs", label: "Utilisateurs & rôles", icon: ShieldCheck, superOnly: true },
  { to: "/admin/messages", label: "Messages reçus", icon: Inbox },
  { to: "/admin/parametres", label: "Paramètres du GIE", icon: Settings },
  { to: "/admin/mot-du-president", label: "Le mot du Président", icon: Quote, presidentOnly: true },
] as const;

function AdminLayout() {
  const { loading, isStaff, user, roles } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;
  if (!isStaff) return <Navigate to="/espace" />;
  if (user?.user_metadata?.["must_change_password"] === true) return <Navigate to="/changer-mot-de-passe" />;

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
          {nav.filter((n) => (!("superOnly" in n) || roles.includes("super_admin")) && (!("presidentOnly" in n) || canEditPresident(roles))).map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium opacity-80 transition hover:bg-sidebar-accent hover:opacity-100 data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary data-[status=active]:opacity-100">
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 pb-4"><InstallAppButton className="w-full" /></div>
        <div className="border-t border-sidebar-border p-4 text-xs">
          <div className="truncate font-semibold text-sidebar-accent-foreground">{user?.email}</div>
          <div className="opacity-70">{roles.filter((r) => r !== "chauffeur").map((r) => ROLE_LABELS[r]).join(", ")}</div>
          <button onClick={logout} className="mt-3 flex items-center gap-2 opacity-80 hover:opacity-100"><LogOut className="h-3.5 w-3.5" /> Déconnexion</button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex min-h-14 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></Button>
          <div className="hidden text-sm text-muted-foreground md:block">Espace administration</div>
          <div className="flex flex-wrap items-center gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/changer-mot-de-passe"><KeyRound className="h-4 w-4" />Changer mon mot de passe</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/espace">Mon espace membre</Link></Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
