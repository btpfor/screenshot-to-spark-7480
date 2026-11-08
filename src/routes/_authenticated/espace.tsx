import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fcfa, dateFr } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/espace")({
  head: () => ({ meta: [{ title: "Mon espace — GIE VIP BOK GUIS GUIS" }, { name: "robots", content: "noindex" }] }),
  component: Espace,
});

function Espace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["espace", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: d } = await supabase.from("drivers").select("*").ilike("email", user!.email ?? "").maybeSingle();
      const { data: t } = d ? await supabase.from("transactions").select("*").eq("driver_id", d.id).order("paid_at", { ascending: false }) : { data: [] };
      return { driver: d, tx: t ?? [] };
    },
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5">
      <div className="flex items-center justify-between">
        <Logo />
        <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>Déconnexion</Button>
      </div>
      {!data?.driver ? (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground">Aucun dossier chauffeur n'est lié à {user?.email}. Contactez l'administration du GIE.</p>
      ) : (
        <>
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <div className="text-xs text-muted-foreground">{data.driver.matricule}</div>
            <h1 className="text-2xl font-bold">{data.driver.first_name} {data.driver.last_name}</h1>
            <p className="text-sm text-muted-foreground">{data.driver.platform} · {data.driver.status}</p>
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <h2 className="mb-3 font-semibold">Mes cotisations</h2>
            {data.tx.length === 0 ? <p className="text-sm text-muted-foreground">Aucune opération.</p> : (
              <ul className="divide-y text-sm">{data.tx.map((t) => (
                <li key={t.id} className="flex justify-between py-2"><span>{t.receipt_number} · {dateFr(t.paid_at)}</span><span>{fcfa(t.amount)} {t.status === "impaye" && "(impayé)"}</span></li>
              ))}</ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
