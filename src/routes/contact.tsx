import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { Leaders } from "@/components/Leaders";
import { gieQuery, waHref } from "@/lib/gie";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — GIE VIP BOK GUIS GUIS Transport Sénégal" },
      { name: "description", content: "Contactez le Président, le Secrétaire général ou le Trésorier du GIE VIP BOK GUIS GUIS." },
      { property: "og:title", content: "Contact — GIE VIP BOK GUIS GUIS" },
      { property: "og:description", content: "Coordonnées officielles des responsables du GIE et formulaire de contact." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { data } = useQuery(gieQuery);
  const s = data?.settings;
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name")).trim(), message = String(f.get("message")).trim();
    if (name.length < 2 || message.length < 5) { toast.error("Merci de renseigner votre nom et un message."); return; }
    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert({
      name, message, phone: String(f.get("phone") || "").trim() || null, email: String(f.get("email") || "").trim() || null,
    });
    setBusy(false);
    if (error) { toast.error("Envoi impossible, réessayez."); return; }
    toast.success("Message envoyé. L'administration vous recontactera.");
    form.reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/"><Logo /></Link>
          <Button asChild size="sm"><Link to="/auth">Espace membre</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-12 px-5 py-14">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-gold">Contact</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{s?.official_name ?? "GIE VIP BOK GUIS GUIS TRANSPORT SENEGAL"}</h1>
          {s?.slogan && <p className="mt-2 italic text-muted-foreground">« {s.slogan} »</p>}
        </div>
        <section>
          <h2 className="mb-5 text-xl font-semibold">Nos responsables</h2>
          <Leaders />
        </section>
        <section className="grid gap-8 md:grid-cols-5">
          <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-card md:col-span-3">
            <h2 className="text-xl font-semibold">Écrire à l'administration</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Nom complet *</Label><Input id="name" name="name" required maxLength={100} /></div>
              <div className="space-y-1.5"><Label htmlFor="phone">Téléphone</Label><Input id="phone" name="phone" maxLength={30} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" maxLength={150} /></div>
            <div className="space-y-1.5"><Label htmlFor="message">Message *</Label><Textarea id="message" name="message" required rows={5} maxLength={2000} /></div>
            <Button disabled={busy}>{busy ? "Envoi…" : "Envoyer le message"}</Button>
          </form>
          <div className="space-y-4 md:col-span-2">
            <div className="rounded-2xl bg-navy p-6 text-navy-foreground shadow-card">
              <h3 className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-gold" /> Horaires de disponibilité</h3>
              <p className="mt-3 whitespace-pre-line text-sm opacity-85">{s?.opening_hours || "Horaires communiqués prochainement par l'administration."}</p>
            </div>
            {s?.whatsapp_phone && (
              <Button asChild size="lg" variant="outline" className="w-full">
                <a href={waHref(s.whatsapp_phone, "Bonjour, je souhaite contacter le GIE VIP BOK GUIS GUIS.")} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" /> Nous écrire sur WhatsApp
                </a>
              </Button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
