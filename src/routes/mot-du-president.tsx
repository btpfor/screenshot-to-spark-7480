import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { PresidentMessage } from "@/components/PresidentMessage";
import { presidentQuery } from "@/lib/president";

export const Route = createFileRoute("/mot-du-president")({
  loader: ({ context }) => context.queryClient.ensureQueryData(presidentQuery),
  head: () => ({ meta: [
    { title: "Le mot du Président — GIE VIP BOK GUIS GUIS" },
    { name: "description", content: "Le message du Président du GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL : solidarité, discipline et entraide." },
    { property: "og:title", content: "Le mot du Président — GIE VIP BOK GUIS GUIS" },
    { property: "og:description", content: "La vision et l’engagement du Président pour les chauffeurs et le transport au Sénégal." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: PresidentPage,
});

function PresidentPage() {
  const { data: message } = useSuspenseQuery(presidentQuery);
  return <div className="min-h-screen bg-background">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4"><Link to="/"><Logo /></Link><Button asChild size="sm"><Link to="/auth">Espace membre</Link></Button></div></header>
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-7">
      <Button asChild variant="ghost" size="sm" className="mb-8"><Link to="/"><ArrowLeft />Accueil</Link></Button>
      {message ? <PresidentMessage message={message} full /> : <div className="py-16"><h1 className="text-3xl font-bold">Le mot du Président</h1><p className="mt-4 text-muted-foreground">Le message du Président n’est pas publié actuellement.</p></div>}
    </main>
    <footer className="border-t px-5 py-7 text-center text-sm text-muted-foreground">GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL</footer>
  </div>;
}