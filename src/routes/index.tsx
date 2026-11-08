import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, Car, Globe2, HandHeart, ShieldCheck, Users, ArrowRight} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Leaders } from "@/components/Leaders";
import hero from "@/assets/hero-dakar.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GIE VIP BOK GUIS GUIS — Transport Sénégal" },
      { name: "description", content: "300 chauffeurs unis pour moderniser le transport au Sénégal : solidarité, financement automobile et partenariats." },
      { property: "og:title", content: "GIE VIP BOK GUIS GUIS — Transport Sénégal" },
      { property: "og:description", content: "Solidarité, financement automobile et professionnalisation des chauffeurs au Sénégal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const pillars = [
  { icon: HandHeart, title: "Solidarité", text: "Une caisse commune et un accompagnement en cas d'accident, de panne ou de difficulté." },
  { icon: Banknote, title: "Financement automobile", text: "Des solutions pour que chaque chauffeur devienne propriétaire de son véhicule." },
  { icon: Car, title: "Acquisition collective", text: "Des achats groupés pour réduire le coût des véhicules rendus au Sénégal." },
  { icon: Globe2, title: "Partenariats internationaux", text: "Fournisseurs, banques, assureurs et plateformes au service des membres." },
  { icon: ShieldCheck, title: "Professionnalisation", text: "Permis, assurances et visites techniques suivis pour un service irréprochable." },
  { icon: Users, title: "Conditions de travail", text: "Une voix collective pour défendre les intérêts des chauffeurs." },
];

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="absolute inset-x-0 top-0 z-20 text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a href="#mission" className="opacity-80 hover:opacity-100">Mission</a>
            <a href="#services" className="opacity-80 hover:opacity-100">Services</a>
            <a href="#responsables" className="opacity-80 hover:opacity-100">Responsables</a>
            <Link to="/contact" className="opacity-80 hover:opacity-100">Contact</Link>
          </nav>
          <Button asChild variant="secondary" size="sm"><Link to="/auth">Espace membre</Link></Button>
        </div>
      </header>

      <section className="relative min-h-[88vh] overflow-hidden">
        <img src={hero} alt="Chauffeur du GIE à Dakar" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover" />
        <div className="bg-hero absolute inset-0" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-5 pt-24 text-primary-foreground">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/25 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
            <span className="flag-bar h-2 w-6 rounded-full" /> Groupement d'Intérêt Économique
          </span>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Moderniser le transport au Sénégal, <span className="text-accent">ensemble.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg opacity-85">
            Près de 300 chauffeurs unis pour la solidarité, l'accès au financement automobile et la professionnalisation du métier.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth">Accéder à mon espace <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
              <a href="#mission">Découvrir le GIE</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="mission" className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary">Notre mission</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Une organisation professionnelle au service des chauffeurs</h2>
        </div>
        <div className="space-y-4 text-muted-foreground">
          <p>Le GIE VIP BOK GUIS GUIS rassemble les chauffeurs actifs sur les plateformes numériques comme Yango et dans le transport traditionnel.</p>
          <p>Notre objectif : digitaliser nos activités, faciliter la gestion administrative et ouvrir de nouvelles opportunités économiques à chaque membre.</p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[["300", "chauffeurs"], ["100%", "solidaires"], ["1", "union"]].map(([n, l]) => (
              <div key={l} className="rounded-xl border bg-card p-4">
                <div className="font-display text-2xl font-bold text-primary">{n}</div>
                <div className="text-xs">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="bg-sidebar py-24 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-5">
          <p className="text-sm font-bold uppercase tracking-widest text-sidebar-primary">Nos services</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-bold text-sidebar-accent-foreground sm:text-4xl">Ce que le GIE apporte à ses membres</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-sidebar-border sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p) => (
              <div key={p.title} className="bg-sidebar p-8 transition-colors hover:bg-sidebar-accent">
                <p.icon className="h-7 w-7 text-sidebar-primary" />
                <h3 className="mt-5 text-lg font-semibold text-sidebar-accent-foreground">{p.title}</h3>
                <p className="mt-2 text-sm opacity-75">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="responsables" className="mx-auto max-w-7xl px-5 py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-gold">Nos responsables</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Une équipe joignable directement</h2>
          </div>
          <Button asChild variant="outline"><Link to="/contact">Page contact <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <Leaders />
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-muted-foreground">
          <Logo />
          <span>© {new Date().getFullYear()} GIE VIP BOK GUIS GUIS Transport Sénégal</span>
        </div>
      </footer>
    </div>
  );
}
