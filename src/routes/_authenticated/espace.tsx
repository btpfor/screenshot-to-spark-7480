import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fcfa, dateFr } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { MemberPhoto } from "@/components/MemberPhoto";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ScaledCard } from "@/components/MemberCardDialog";

export const Route = createFileRoute("/_authenticated/espace")({
  head: () => ({ meta: [
    { title: "Mon espace — GIE VIP BOK GUIS GUIS" },
    { name: "description", content: "Dossier, carte de membre et cotisations personnelles au GIE." },
    { property: "og:title", content: "Mon espace — GIE VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Espace personnel des membres du GIE." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Espace,
});

function Espace() {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["espace", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: d } = await supabase.from("drivers").select("*").eq("user_id", user!.id).maybeSingle();
      if (!d) return { driver: null, tx: [], vehicles: [] };
      const [t, v] = await Promise.all([
        supabase.from("transactions").select("*").eq("driver_id", d.id).order("paid_at", { ascending: false }),
        supabase.from("vehicles").select("*").eq("driver_id", d.id),
      ]);
      return { driver: d, tx: t.data ?? [], vehicles: v.data ?? [] };
    },
  });
  const logout = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  if (data?.driver?.must_change_password) return <Navigate to="/changer-mot-de-passe" />;

  const d = data?.driver;
  const paid = (data?.tx ?? []).filter((t) => t.status === "paye" && t.kind !== "depense").reduce((s, t) => s + Number(t.amount), 0);
  const debts = (data?.tx ?? []).filter((t) => t.status === "impaye").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5">
      <div className="no-print flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          {isStaff && <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin" })}>Administration</Button>}
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={logout}>Déconnexion</Button>
        </div>
      </div>
      {isLoading ? <p className="text-muted-foreground">Chargement…</p> : !d ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">Aucun dossier membre n'est lié à ce compte.</p>
      ) : (
        <>
          <div className="grid gap-4">
            <div className="no-print rounded-xl border bg-card p-6 shadow-card">
              <div className="flex items-center gap-4">
                <MemberPhoto path={d.photo_url} className="h-16 w-16" />
                <div>
                  <h1 className="text-2xl font-bold">{d.first_name} {d.last_name}</h1>
                  <p className="font-mono text-sm text-primary">{d.matricule}</p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Téléphone</dt><dd>{d.phone}</dd>
                <dt className="text-muted-foreground">Statut</dt><dd className="capitalize">{d.status}</dd>
                <dt className="text-muted-foreground">Adhésion</dt><dd>{dateFr(d.join_date)}</dd>
                <dt className="text-muted-foreground">Plateforme</dt><dd>{d.platform}</dd>
              </dl>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold">Ma carte de membre</h2>
            <ScaledCard member={d} />
          </div>

          <div className="no-print grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-card"><div className="text-xs text-muted-foreground">Total cotisé</div><div className="mt-1 font-display text-2xl font-bold text-primary">{fcfa(paid)}</div></div>
            <div className="rounded-xl border bg-card p-5 shadow-card"><div className="text-xs text-muted-foreground">Dettes en cours</div><div className={`mt-1 font-display text-2xl font-bold ${debts ? "text-destructive" : ""}`}>{fcfa(debts)}</div></div>
          </div>

          <div className="no-print rounded-xl border bg-card p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Car className="h-4 w-4 text-primary" /> Mon véhicule</h2>
            {data!.vehicles.length === 0 ? <p className="text-sm text-muted-foreground">Aucun véhicule affecté.</p> : data!.vehicles.map((v) => (
              <div key={v.id} className="text-sm">{v.brand} {v.model} — <b>{v.plate}</b> · assurance jusqu'au {dateFr(v.insurance_expiry)}</div>
            ))}
          </div>

          <div className="no-print rounded-xl border bg-card p-5 shadow-card">
            <h2 className="mb-3 font-semibold">Historique des cotisations</h2>
            {data!.tx.length === 0 ? <p className="text-sm text-muted-foreground">Aucune opération.</p> : (
              <ul className="divide-y text-sm">{data!.tx.map((t) => (
                <li key={t.id} className="flex justify-between py-2"><span>{t.receipt_number} · {dateFr(t.paid_at)}</span><span>{fcfa(t.amount)} {t.status === "impaye" && <span className="text-destructive">(impayé)</span>}</span></li>
              ))}</ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
