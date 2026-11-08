import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, Phone, User } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { bureauQuery } from "@/lib/bureau";
import { telHref, waHref } from "@/lib/gie";

export const Route = createFileRoute("/membres-du-bureau")({
  loader: ({ context }) => context.queryClient.ensureQueryData(bureauQuery),
  head: () => ({ meta: [
    { title: "Les membres du Bureau — GIE VIP BOK GUIS GUIS" },
    { name: "description", content: "Notre équipe dirigeante : une équipe engagée au service des chauffeurs, de la solidarité et du développement du transport au Sénégal." },
    { property: "og:title", content: "Les membres du Bureau — GIE VIP BOK GUIS GUIS" },
    { property: "og:description", content: "L'équipe dirigeante du GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: BureauPage,
});

function BureauPage() {
  const { data: bureau } = useSuspenseQuery(bureauQuery);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Link to="/"><Logo /></Link>
          <Button asChild size="sm"><Link to="/auth">Espace membre</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-7">
        <Button asChild variant="ghost" size="sm" className="mb-8"><Link to="/"><ArrowLeft />Accueil</Link></Button>

        <div className="president-reveal text-center">
          <p className="flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest text-gold">
            <span aria-hidden="true" className="h-px w-8 bg-gold" />Le bureau du GIE<span aria-hidden="true" className="h-px w-8 bg-gold" />
          </p>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">NOTRE ÉQUIPE DIRIGEANTE</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Une équipe engagée au service des chauffeurs, de la solidarité et du développement du transport au Sénégal.
          </p>
        </div>

        {bureau.groupPhotoUrl && (
          <figure className="bureau-photo-reveal mx-auto mt-12 max-w-4xl">
            <div className="bg-gold-gradient rounded-2xl p-1.5 shadow-card">
              <img
                src={bureau.groupPhotoUrl}
                alt="Photographie officielle des membres du bureau du GIE VIP BOK GUIS GUIS"
                className="w-full rounded-xl object-cover"
              />
            </div>
            <figcaption className="mt-3 text-center text-sm text-muted-foreground">Les membres du bureau du GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL</figcaption>
          </figure>
        )}

        <p className="mx-auto mt-12 max-w-3xl text-center leading-relaxed text-muted-foreground">
          Le GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL est dirigé par une équipe engagée qui œuvre pour la défense des intérêts de ses membres, le développement des partenariats et la modernisation du secteur du transport.
        </p>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bureau.members.map((m, index) => (
            <article key={m.id} className="bureau-card group relative overflow-hidden rounded-2xl border bg-card p-6 text-center shadow-card" style={{ animationDelay: `${index * 90}ms` }}>
              <div className="bg-gold-gradient absolute inset-x-0 top-0 h-1" />
              <div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full border-4 border-gold/70 bg-muted">
                {m.photoUrl
                  ? <img src={m.photoUrl} alt={m.full_name ? `Portrait de ${m.full_name}` : m.role_label} className="h-full w-full object-cover" />
                  : <User className="h-12 w-12 text-muted-foreground" aria-hidden="true" />}
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-widest text-gold">{m.role_label}</p>
              <h2 className="mt-2 min-h-7 text-lg font-semibold">{m.full_name || " "}</h2>
              {m.phone && (
                <>
                  <a href={telHref(m.phone)} className="mt-3 flex items-center justify-center gap-2 font-mono text-base font-semibold text-primary hover:underline">
                    <Phone className="h-4 w-4" /> {m.phone}
                  </a>
                  <div className="mt-5 flex gap-2">
                    <Button asChild size="sm" className="flex-1"><a href={telHref(m.phone)}><Phone className="mr-1 h-4 w-4" /> Appeler</a></Button>
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <a href={waHref(m.phone)} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" /> WhatsApp</a>
                    </Button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </main>
      <footer className="border-t px-5 py-7 text-center text-sm text-muted-foreground">GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL</footer>
    </div>
  );
}
