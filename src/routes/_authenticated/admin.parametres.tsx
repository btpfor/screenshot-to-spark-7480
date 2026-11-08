import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gieQuery } from "@/lib/gie";
import { useAuth, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/parametres")({
  head: () => ({ meta: [
    { title: "Paramètres du GIE — VIP BOK GUIS GUIS" },
    { name: "description", content: "Identité et coordonnées officielles du GIE VIP BOK GUIS GUIS." },
    { property: "og:title", content: "Paramètres du GIE — VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Coordonnées et identité du GIE." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Settings,
});

const EDITORS: AppRole[] = ["super_admin", "president", "secretaire"];
type Contact = { id?: string; role_label: string; person_name: string | null; phone: string; sort_order: number };

function readImage(file: File, max = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * k; c.height = img.height * k;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function Settings() {
  const { can, loading } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery(gieQuery);
  const [form, setForm] = useState({ official_name: "", slogan: "", president_name: "", whatsapp_phone: "", opening_hours: "", logo_data: null as string | null, signature_data: null as string | null });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    setForm({ official_name: s.official_name, slogan: s.slogan, president_name: s.president_name, whatsapp_phone: s.whatsapp_phone, opening_hours: s.opening_hours, logo_data: s.logo_data, signature_data: s.signature_data });
    setContacts(data.contacts.map((c) => ({ id: c.id, role_label: c.role_label, person_name: c.person_name, phone: c.phone, sort_order: c.sort_order })));
  }, [data]);

  if (loading) return null;
  if (!can(EDITORS)) return <p className="text-muted-foreground">Accès réservé au Président, au Secrétaire général et au super administrateur.</p>;

  const save = async () => {
    if (contacts.some((c) => !c.role_label.trim() || !c.phone.trim())) { toast.error("Chaque responsable doit avoir une fonction et un téléphone."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("gie_settings").update({ ...form, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw error;
      if (removed.length) await supabase.from("gie_contacts").delete().in("id", removed);
      for (const [i, c] of contacts.entries()) {
        const row = { role_label: c.role_label.trim(), person_name: c.person_name?.trim() || null, phone: c.phone.trim(), sort_order: i + 1 };
        const { error: e } = c.id ? await supabase.from("gie_contacts").update(row).eq("id", c.id) : await supabase.from("gie_contacts").insert(row);
        if (e) throw e;
      }
      setRemoved([]);
      await qc.invalidateQueries({ queryKey: ["gie-settings"] });
      toast.success("Coordonnées mises à jour sur le site et les cartes.");
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const upload = (k: "logo_data" | "signature_data") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setForm({ ...form, [k]: await readImage(f) });
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Paramètres du GIE</h1>
        <p className="text-sm text-muted-foreground">Coordonnées officielles — reprises automatiquement sur le site public et les cartes de membre.</p>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-card">
        <h2 className="font-semibold">Identité</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Nom officiel</Label><Input value={form.official_name} onChange={set("official_name")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Slogan</Label><Input value={form.slogan} onChange={set("slogan")} /></div>
          <div className="space-y-1.5"><Label>Nom du président (signature)</Label><Input value={form.president_name} onChange={set("president_name")} /></div>
          <div className="space-y-1.5"><Label>Numéro WhatsApp du GIE</Label><Input value={form.whatsapp_phone} onChange={set("whatsapp_phone")} /></div>
          <div className="space-y-1.5">
            <Label>Logo officiel</Label>
            <div className="flex items-center gap-3">
              {form.logo_data && <img src={form.logo_data} alt="" className="h-14 w-14 rounded border object-contain" />}
              <Input type="file" accept="image/*" onChange={upload("logo_data")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Signature du président (fond blanc)</Label>
            <div className="flex items-center gap-3">
              {form.signature_data && <img src={form.signature_data} alt="" className="h-14 w-28 rounded border bg-card object-contain" />}
              <Input type="file" accept="image/*" onChange={upload("signature_data")} />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Horaires de disponibilité</Label><Textarea rows={3} value={form.opening_hours} onChange={set("opening_hours")} placeholder="Ex. Lundi – Samedi : 9h – 18h" /></div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Coordonnées des responsables</h2>
          <Button size="sm" variant="outline" onClick={() => setContacts([...contacts, { role_label: "", person_name: "", phone: "", sort_order: contacts.length + 1 }])}><Plus className="mr-1 h-4 w-4" /> Ajouter</Button>
        </div>
        {contacts.map((c, i) => (
          <div key={c.id ?? `new-${i}`} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="space-y-1.5"><Label>Fonction</Label><Input value={c.role_label} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, role_label: e.target.value } : x))} /></div>
            <div className="space-y-1.5"><Label>Nom</Label><Input value={c.person_name ?? ""} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, person_name: e.target.value } : x))} /></div>
            <div className="space-y-1.5"><Label>Téléphone</Label><Input value={c.phone} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} /></div>
            <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => { if (c.id) setRemoved([...removed, c.id]); setContacts(contacts.filter((_, j) => j !== i)); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </section>

      <Button size="lg" onClick={save} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer les modifications"}</Button>
    </div>
  );
}
