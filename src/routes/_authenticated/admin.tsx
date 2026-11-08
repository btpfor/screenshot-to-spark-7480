import { createFileRoute, Link, Navigate, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Inbox, KeyRound, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, UsersRound, X, Quote } from "lucide-react";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { canEditPresident } from "@/lib/president-rules";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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
  { to: "/admin/bureau", label: "Gestion du bureau", icon: UsersRound },
  { to: "/admin/mot-du-president", label: "Le mot du Président", icon: Quote, presidentOnly: true },
] as const;

function AdminLayout() {
  const { loading, isStaff, user, roles } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Chargement…</div>;
  if (!isStaff) return <Navigate to="/espace" />;
  if (user?.user_metadata?.["must_change_password"] === true) return <Navigate to="/changer-mot-de-passe" />;

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const sidebar = (mobile: boolean) => <>
    <div className="flex items-center justify-between p-5">
      <Logo />
      {mobile && <SheetClose asChild><Button variant="ghost" size="icon" className="shrink-0" aria-label="Fermer le menu administratif"><X className="h-5 w-5" /></Button></SheetClose>}
    </div>
    <nav aria-label={mobile ? "Navigation administrative mobile" : "Navigation administrative"} className="flex-1 space-y-1 px-3">
      {nav.filter((n) => (!("superOnly" in n) || roles.includes("super_admin")) && (!("presidentOnly" in n) || canEditPresident(roles))).map((n) => (
        <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium opacity-80 transition hover:bg-sidebar-accent hover:opacity-100 data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-primary data-[status=active]:opacity-100">
          <n.icon className="h-4 w-4 shrink-0" /> {n.label}
        </Link>
      ))}
    </nav>
    <div className="border-t border-sidebar-border p-4 text-xs">
      <div className="truncate font-semibold text-sidebar-accent-foreground">{user?.email}</div>
      <div className="opacity-70">{roles.filter((r) => r !== "chauffeur").map((r) => ROLE_LABELS[r]).join(", ")}</div>
      <Button variant="ghost" size="sm" onClick={logout} className="mt-3 flex h-auto min-h-0 items-center justify-start gap-2 rounded-none p-0 text-xs font-normal opacity-80 hover:bg-transparent hover:text-inherit hover:opacity-100"><LogOut className="h-3.5 w-3.5" /> Déconnexion</Button>
    </div>
  </>;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
    <div className="flex min-h-screen bg-background">
      <aside className="safe-bottom no-print hidden shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-56 xl:w-64">
        {sidebar(false)}
      </aside>
      <SheetContent side="left" hideClose aria-describedby={undefined} overlayClassName="z-30 bg-foreground/40 lg:hidden" className="safe-bottom no-print z-40 flex w-64 max-w-full flex-col gap-0 overflow-y-auto border-0 bg-sidebar p-0 text-sidebar-foreground shadow-none lg:hidden">
        <SheetTitle className="sr-only">Menu administratif</SheetTitle>
        {sidebar(true)}
      </SheetContent>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top no-print grid grid-cols-[auto_minmax(0,1fr)] min-h-14 items-center gap-2 border-b bg-card px-4 py-2 lg:flex lg:justify-between">
          <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu administratif"><Menu className="h-5 w-5" /></Button></SheetTrigger>
          <div className="hidden text-sm text-muted-foreground lg:block">Espace administration</div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
            <Button asChild variant="ghost" size="sm" className="h-auto min-h-11 whitespace-normal"><Link to="/changer-mot-de-passe"><KeyRound className="h-4 w-4 shrink-0" />Changer mon mot de passe</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/espace">Mon espace membre</Link></Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="safe-bottom min-w-0 flex-1 p-4 md:p-6 xl:p-8"><Outlet /></main>
      </div>
    </div>
    </Sheet>
  );
}
