import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { dateFr } from "@/lib/format";

export const Route = createFileRoute("/verifier/$matricule")({
  head: ({ params }) => ({
    meta: [
      { title: `Vérification ${params.matricule} — GIE VIP BOK GUIS GUIS` },
      { name: "description", content: "Vérification de l'authenticité d'une carte de membre du GIE." },
      { property: "og:title", content: "Vérification de carte de membre" },
      { property: "og:description", content: "Vérifiez l'authenticité d'une carte de membre du GIE VIP BOK GUIS GUIS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Verify,
});

function Verify() {
  const { matricule } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["verify", matricule],
    queryFn: async () => (await supabase.rpc("verify_member", { _matricule: matricule })).data?.[0] ?? null,
  });
  const valid = data && data.status === "actif";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 text-center shadow-card">
        <Link to="/" className="inline-block"><Logo /></Link>
        {isLoading ? <p className="text-muted-foreground">Vérification…</p> : data ? (
          <>
            {valid ? <BadgeCheck className="mx-auto h-16 w-16 text-success" /> : <ShieldX className="mx-auto h-16 w-16 text-warning" />}
            <div>
              <h1 className="text-xl font-bold">{valid ? "Carte authentique" : "Membre non actif"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Statut : {data.status}</p>
            </div>
            <div className="rounded-xl bg-muted p-4 text-sm">
              <div className="text-lg font-semibold">{data.first_name} {data.last_name}</div>
              <div className="font-mono text-primary">{data.matricule}</div>
              <div className="text-muted-foreground">Membre depuis le {dateFr(data.join_date)}</div>
            </div>
          </>
        ) : (
          <>
            <ShieldX className="mx-auto h-16 w-16 text-destructive" />
            <h1 className="text-xl font-bold">Carte non reconnue</h1>
            <p className="text-sm text-muted-foreground">Aucun membre ne correspond au matricule {matricule}.</p>
          </>
        )}
      </div>
    </div>
  );
}
