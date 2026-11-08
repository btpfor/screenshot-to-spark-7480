import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, MessageCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { analyzeMessage } from "@/lib/messages.functions";
import { waHref } from "@/lib/gie";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  component: Messages,
});

type Msg = Database["public"]["Tables"]["contact_messages"]["Row"];

function Messages() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const { data: msgs = [] } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: async () => (await supabase.from("contact_messages").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const shown = msgs.filter((m) => filter === "all" || !m.handled);
  const current = msgs.find((m) => m.id === selected) ?? shown[0];
  const refresh = () => qc.invalidateQueries({ queryKey: ["contact-messages"] });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Messages reçus</h1>
          <p className="text-sm text-muted-foreground">Résumé et brouillon de réponse générés par l'IA, à relire avant envoi.</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" /> Saisir un message reçu</Button>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={filter === "open" ? "default" : "outline"} onClick={() => setFilter("open")}>À traiter ({msgs.filter((m) => !m.handled).length})</Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Tous ({msgs.length})</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="max-h-[70vh] divide-y overflow-y-auto rounded-xl border bg-card shadow-card">
          {shown.length === 0 && <p className="p-6 text-sm text-muted-foreground">Aucun message.</p>}
          {shown.map((m) => (
            <button key={m.id} onClick={() => setSelected(m.id)} className={`block w-full p-4 text-left transition hover:bg-muted/50 ${current?.id === m.id ? "bg-muted" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{m.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.ai_category && <Badge variant="secondary">{m.ai_category}</Badge>}
                {m.handled && <Badge variant="outline">Traité</Badge>}
                {m.source === "manuel" && <Badge variant="outline">Saisi</Badge>}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.ai_summary ?? m.message}</p>
            </button>
          ))}
        </div>
        {current ? <Detail key={current.id} msg={current} onChange={refresh} /> : <div />}
      </div>

      {adding && <AddMessage onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); setSelected(id); refresh(); }} />}
    </div>
  );
}

function Detail({ msg, onChange }: { msg: Msg; onChange: () => void }) {
  const analyze = useServerFn(analyzeMessage);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(msg.ai_draft ?? "");
  useEffect(() => setDraft(msg.ai_draft ?? ""), [msg.ai_draft]);

  const run = async () => {
    setBusy(true);
    try { const r = await analyze({ data: { messageId: msg.id } }); setDraft(r.draft); onChange(); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  const saveDraft = async () => {
    await supabase.from("contact_messages").update({ ai_draft: draft }).eq("id", msg.id);
    toast.success("Brouillon enregistré"); onChange();
  };
  const toggleHandled = async () => {
    await supabase.from("contact_messages").update({ handled: !msg.handled }).eq("id", msg.id); onChange();
  };
  const remove = async () => {
    if (!confirm("Supprimer ce message ?")) return;
    await supabase.from("contact_messages").delete().eq("id", msg.id); onChange();
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{msg.name}</h2>
          <p className="text-sm text-muted-foreground">{[msg.phone, msg.email].filter(Boolean).join(" · ") || "Aucune coordonnée"} — {new Date(msg.created_at).toLocaleString("fr-FR")}</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={toggleHandled}><Check className="mr-1 h-4 w-4" /> {msg.handled ? "Rouvrir" : "Marquer traité"}</Button>
          <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">{msg.message}</div>

      <div className="rounded-lg border border-gold/40 bg-gold/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-gold" /> Analyse IA</h3>
          <Button size="sm" onClick={run} disabled={busy}>{busy ? "Analyse…" : msg.ai_summary ? "Régénérer" : "Résumer et proposer une réponse"}</Button>
        </div>
        {msg.ai_summary ? (
          <div className="mt-3 space-y-1 text-sm">
            {msg.ai_category && <Badge variant="secondary">{msg.ai_category}</Badge>}
            <p><b>Résumé :</b> {msg.ai_summary}</p>
          </div>
        ) : <p className="mt-2 text-sm text-muted-foreground">Pas encore analysé.</p>}
      </div>

      {(msg.ai_draft || draft) && (
        <div className="space-y-2">
          <Label htmlFor="draft">Brouillon de réponse (modifiable)</Label>
          <Textarea id="draft" rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={saveDraft}>Enregistrer</Button>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(draft); toast.success("Copié"); }}><Copy className="mr-1 h-4 w-4" /> Copier</Button>
            {msg.phone && <Button asChild size="sm"><a href={waHref(msg.phone, draft)} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" /> Répondre sur WhatsApp</a></Button>}
            {msg.email && <Button asChild size="sm" variant="outline"><a href={`mailto:${msg.email}?subject=${encodeURIComponent("Réponse du GIE VIP BOK GUIS GUIS")}&body=${encodeURIComponent(draft)}`}>Répondre par email</a></Button>}
          </div>
        </div>
      )}
    </div>
  );
}

function AddMessage({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { data, error } = await supabase.from("contact_messages").insert({
      name: String(f.get("name")).trim(), message: String(f.get("message")).trim(), source: "manuel",
      phone: String(f.get("phone") || "").trim() || null, email: String(f.get("email") || "").trim() || null,
    }).select("id").single();
    setBusy(false);
    if (error) { toast.error("Vérifiez le nom (2 caractères min.) et le message (5 caractères min.)."); return; }
    onAdded(data.id);
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Saisir un message reçu</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Collez le texte d'une demande reçue par téléphone, WhatsApp ou courrier pour l'analyser.</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="name">Expéditeur *</Label><Input id="name" name="name" required maxLength={100} /></div>
            <div className="space-y-1.5"><Label htmlFor="phone">Téléphone</Label><Input id="phone" name="phone" maxLength={30} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" maxLength={150} /></div>
          <div className="space-y-1.5"><Label htmlFor="message">Texte du message *</Label><Textarea id="message" name="message" required rows={6} maxLength={2000} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button disabled={busy}>Ajouter</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
