import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, Car, Globe2, HandHeart, ShieldCheck, Users, ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Leaders } from "@/components/Leaders";
import { InstallAppButton } from "@/components/InstallApp";
import hero from "@/assets/hero-dakar.jpg";
import { useSuspenseQuery } from "@tanstack/react-query";
import { presidentQuery } from "@/lib/president";
import { PresidentMessage } from "@/components/PresidentMessage";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(presidentQuery),
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const missionStatsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stats = missionStatsRef.current;
    if (!stats || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        stats.dataset.revealed = "true";
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(stats);
    return () => observer.disconnect();
  }, []);
  const servicesRef = useRef<HTMLElement>(null);
  const [servicesVisible, setServicesVisible] = useState(false);
  useEffect(() => {
    const section = servicesRef.current;
    if (!section || !('IntersectionObserver' in window)) { setServicesVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setServicesVisible(true); observer.disconnect(); }
    }, { threshold: 0.08 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const section = servicesRef.current;
    if (!section || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-visible", "true");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.25 });
    section.querySelectorAll(".service-item").forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);
  const { data: president } = useSuspenseQuery(presidentQuery);
  return (
    <div className="min-h-screen bg-background">
      <Collapsible asChild open={menuOpen} onOpenChange={setMenuOpen}>
      <header className="absolute inset-x-0 top-0 z-20 text-primary-foreground" onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          event.preventDefault(); setMenuOpen(false); menuTrigger.current?.focus();
        }
      }}>
        <div className="safe-top mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5 sm:py-5 lg:flex lg:justify-between">
          <Logo />
          <nav aria-label="Navigation principale" className="hidden items-center gap-5 text-sm font-medium lg:flex">
            <a href="#mission" className="opacity-80 hover:opacity-100">Mission</a>
            {president && <Link to="/mot-du-president" className="opacity-80 hover:opacity-100">Le mot du Président</Link>}
            <a href="#services" className="opacity-80 hover:opacity-100">Services</a>
            <a href="#responsables" className="opacity-80 hover:opacity-100">Responsables</a>
            <Link to="/contact" className="opacity-80 hover:opacity-100">Contact</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2"><Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex"><Link to="/auth">Espace membre</Link></Button><CollapsibleTrigger asChild><Button ref={menuTrigger} variant="secondary" size="icon" className="lg:hidden" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}>{menuOpen ? <X /> : <Menu />}</Button></CollapsibleTrigger></div>
        </div>
        <CollapsibleContent asChild><nav aria-label="Navigation principale mobile" className="mx-4 grid rounded-lg border bg-sidebar p-3 text-sidebar-foreground shadow-card lg:hidden" onClick={(event) => {
          const link = (event.target as HTMLElement).closest('a');
          if (!link) return;
          setMenuOpen(false);
          const href = link.getAttribute('href');
          if (href?.startsWith('#')) {
            const section = document.getElementById(href.slice(1));
            section?.focus({ preventScroll: true });
          } else menuTrigger.current?.focus();
        }}><Button asChild variant="ghost" className="justify-start"><a href="#mission">Mission</a></Button>{president && <Button asChild variant="ghost" className="justify-start"><Link to="/mot-du-president">Le mot du Président</Link></Button>}<Button asChild variant="ghost" className="justify-start"><a href="#services">Services</a></Button><Button asChild variant="ghost" className="justify-start"><a href="#responsables">Responsables</a></Button><Button asChild variant="ghost" className="justify-start"><Link to="/contact">Contact</Link></Button><Button asChild variant="secondary"><Link to="/auth">Espace membre</Link></Button></nav></CollapsibleContent>
      </header>
      </Collapsible>

      <section className="relative min-h-[88svh] overflow-hidden">
        <img src={hero} alt="Chauffeur du GIE à Dakar" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover" />
        <div className="bg-hero absolute inset-0" />
        <div className="relative mx-auto flex min-h-[88svh] max-w-7xl flex-col justify-center px-5 pb-10 pt-32 text-primary-foreground">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary-foreground/25 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
            <span className="flag-bar h-2 w-6 rounded-full" /> Groupement d'Intérêt Économique
          </span>
          <h1 className="max-w-3xl text-3xl font-extrabold leading-tight min-[375px]:text-4xl sm:text-6xl">
            Moderniser le transport au Sénégal, <span className="text-accent">ensemble.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg opacity-85">
            Près de 300 chauffeurs unis pour la solidarité, l'accès au financement automobile et la professionnalisation du métier.
          </p>
          <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
            <InstallAppButton className="min-h-10 px-5" />
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth">Accéder à mon espace <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
              <a href="#mission">Découvrir le GIE</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="mission" tabIndex={-1} aria-label="Notre mission" className="mx-auto grid max-w-7xl gap-12 px-5 py-24 md:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary">Notre mission</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Une organisation professionnelle au service des chauffeurs</h2>
        </div>
        <div className="space-y-4 text-muted-foreground">
          <p>Le GIE VIP BOK GUIS GUIS rassemble les chauffeurs actifs sur les plateformes numériques comme Yango et dans le transport traditionnel.</p>
          <p>Notre objectif : digitaliser nos activités, faciliter la gestion administrative et ouvrir de nouvelles opportunités économiques à chaque membre.</p>
          <div ref={missionStatsRef} className="mission-stats grid grid-cols-1 gap-3 pt-4 min-[375px]:grid-cols-3 sm:gap-4">
            {[["300", "chauffeurs"], ["100%", "solidaires"], ["3", "responsables"]].map(([n, l]) => (
              <div key={l} className="mission-stat min-w-0">
                <div className="mission-stat-surface flex min-h-28 flex-col justify-center gap-2 rounded-lg border bg-card px-2 py-5 text-center shadow-card sm:px-4">
                  <div className="mission-stat-number font-display text-3xl font-bold leading-none tabular-nums text-primary">{n}</div>
                  <div className="text-xs font-semibold leading-relaxed text-muted-foreground">{l}</div>
                  <span aria-hidden="true" className="mx-auto mt-1 h-0.5 w-6 bg-gold" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {president && <section className="border-y bg-card py-16 md:py-20"><div className="mx-auto max-w-7xl px-5"><PresidentMessage message={president} /></div></section>}

      <section ref={servicesRef} id="services" tabIndex={-1} aria-label="Nos services" data-revealed={servicesVisible} className="services-section bg-sidebar py-16 text-sidebar-foreground md:py-24">
        <div className="mx-auto max-w-7xl px-5">
          <div className="border-b border-sidebar-border pb-8 md:pb-10">
            <p className="flex items-center gap-3 text-sm font-bold uppercase text-sidebar-primary"><span aria-hidden="true" className="h-px w-8 bg-sidebar-primary" />Nos services</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight text-sidebar-accent-foreground sm:text-4xl">Ce que le GIE apporte à ses membres</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 md:mt-10 md:gap-5">
            {pillars.map((p, index) => (
              <article key={p.title} className="service-item group min-w-0"
                onPointerMove={(event) => {
                  if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
                  const card = event.currentTarget;
                  const bounds = card.getBoundingClientRect();
                  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
                  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
                  card.style.setProperty("--service-rotate-x", `${-y * 10}deg`);
                  card.style.setProperty("--service-rotate-y", `${x * 10}deg`);
                }}
                onPointerLeave={(event) => {
                  event.currentTarget.style.removeProperty("--service-rotate-x");
                  event.currentTarget.style.removeProperty("--service-rotate-y");
                }}>
                <div className="service-surface relative flex h-full min-h-64 flex-col overflow-hidden rounded-lg border border-sidebar-border bg-card p-6 text-card-foreground shadow-card md:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <span className="service-icon grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><p.icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.6} /></span>
                    <span aria-hidden="true" className="font-display text-sm font-medium text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                  <span aria-hidden="true" className="service-rule absolute inset-x-0 bottom-0 h-0.5 bg-gold" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="responsables" tabIndex={-1} aria-label="Nos responsables" className="mx-auto max-w-7xl px-5 py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-gold">Nos responsables</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Une équipe joignable directement</h2>
          </div>
          <Button asChild variant="outline"><Link to="/contact">Page contact <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <Leaders excludedContactIds={["d50c2589-b69d-45d8-8479-f3dd8a97b5ca"]} />
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
