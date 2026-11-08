import { Link } from "@tanstack/react-router";
import { ArrowRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PresidentMessage as Message } from "@/lib/president";

export function PresidentMessage({ message, full = false }: { message: Message; full?: boolean }) {
  const paragraphs = message.body.split(/\n\s*\n/).filter(Boolean);
  const visible = full ? paragraphs : paragraphs.slice(0, 3);
  return (
    <div className="president-reveal grid items-start gap-9 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:gap-16">
      <figure className="mx-auto w-full max-w-lg lg:sticky lg:top-8">
        {message.photoUrl && <div className="overflow-hidden rounded-lg border border-gold/60 p-2 shadow-card"><img src={message.photoUrl} alt={`Portrait officiel de ${message.name}`} width={768} height={768} className="h-auto w-full rounded object-contain" /></div>}
        <figcaption className="mt-5 border-l-2 border-gold pl-4">
          <p className="font-display text-xl font-bold">{message.name}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{message.role_label}</p>
        </figcaption>
      </figure>
      <div className="min-w-0">
        <Quote className="mb-4 h-9 w-9 text-gold" strokeWidth={1.2} aria-hidden="true" />
        {full ? <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Le mot du Président</h1> : <h2 className="text-3xl font-bold leading-tight sm:text-4xl">Le mot du Président</h2>}
        <div className="mt-7 space-y-5 text-base leading-8">
          {visible.map((paragraph, index) => <p key={index} className={`whitespace-pre-line break-words ${index === 0 ? "font-semibold text-primary" : "text-muted-foreground"}`}>{paragraph}</p>)}
        </div>
        {message.signatureUrl && <img src={message.signatureUrl} alt={`Signature de ${message.name}`} className="mt-8 h-20 max-w-full object-contain object-left" />}
        {full ? <div className="mt-8 border-t pt-6">
          <p className="font-display text-lg font-bold">{message.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message.role_label}</p>
        </div> : <Button asChild className="mt-7 h-auto min-h-11 max-w-full whitespace-normal py-3 text-left"><Link to="/mot-du-president">Lire le message du Président <ArrowRight className="shrink-0" /></Link></Button>}
      </div>
    </div>
  );
}