import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gieQuery, telHref, waHref } from "@/lib/gie";

export function Leaders() {
  const { data } = useQuery(gieQuery);
  const contacts = data?.contacts ?? [];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {contacts.map((c) => (
        <div key={c.id} className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card">
          <div className="bg-gold-gradient absolute inset-x-0 top-0 h-1" />
          <p className="text-xs font-bold uppercase tracking-widest text-gold">{c.role_label}</p>
          <h3 className="mt-2 min-h-7 text-lg font-semibold">{c.person_name || " "}</h3>
          <a href={telHref(c.phone)} className="mt-3 flex items-center gap-2 font-mono text-base font-semibold text-primary hover:underline">
            <Phone className="h-4 w-4" /> {c.phone}
          </a>
          <div className="mt-5 flex gap-2">
            <Button asChild size="sm" className="flex-1"><a href={telHref(c.phone)}><Phone className="mr-1 h-4 w-4" /> Appeler</a></Button>
            <Button asChild size="sm" variant="outline" className="flex-1">
              <a href={waHref(c.phone)} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" /> WhatsApp</a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
