import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canEditPresident } from "@/lib/president-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { Database } from "@/integrations/supabase/types";

type Row = Database["public"]["Tables"]["president_message"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/mot-du-president")({
  head: () => ({ meta: [
    { title: "Modifier le mot du Président — VIP BOK GUIS GUIS" },
    { name: "description", content: "Gestion du message institutionnel du Président du GIE." },
    { property: "og:title", content: "Modifier le mot du Président — VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Édition et publication du message du Président." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: PresidentEditor,
});

function MediaPreview({ path, signature = false }: { path: string | null; signature?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!path) return;
    if (path.startsWith("/__l5e/assets-v1/")) { setUrl(path); return; }
    supabase.storage.from("president-media").createSignedUrl(path, 3600).then(({ data }) => { if (active) setUrl(data?.signedUrl ?? null); });
    return () => { active = false; };
  }, [path]);
  return url ? <img src={url} alt={signature ? "Signature actuelle" : "Portrait actuel"} className={signature ? "h-20 max-w-full object-contain" : "h-auto w-full max-w-72 rounded-md border object-contain"} /> : null;
}

function PresidentEditor() {
  const { roles, loading } = useAuth();
  const allowed = canEditPresident(roles);
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ["president-editor"], enabled: !loading && allowed,
    queryFn: async () => {
      const result = await supabase.from("president_message").select("*").eq("id", 1).single();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const [form, setForm] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);

  if (loading) return <p>Chargement…</p>;
  if (!allowed) return <p className="text-muted-foreground">Accès réservé au Président, au Secrétaire général et au super administrateur.</p>;
  if (error) return <p role="alert" className="text-destructive">Impossible de charger le message. Réessayez plus tard.</p>;
  if (isPending || !form) return <p>Chargement…</p>;

  const upload = async (file: File | undefined, field: "photo_path" | "signature_path") => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("Choisissez une image PNG, JPG ou WebP de 5 Mo maximum."); return;
    }
    setBusy(true);
    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${field}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("president-media").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      setForm((current) => current ? { ...current, [field]: path } : current);
      toast.success("Image ajoutée. Enregistrez pour l’appliquer au message.");
    } catch { toast.error("Impossible d’ajouter l’image. Réessayez."); }
    finally { setBusy(false); }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.role_label.trim() || !form.body.trim()) { toast.error("Renseignez le nom, la fonction et le message."); return; }
    setBusy(true);
    try {
      const { error: saveError, data: saved } = await supabase.from("president_message").update({
        name: form.name.trim(), role_label: form.role_label.trim(), body: form.body.trim(),
        photo_path: form.photo_path, signature_path: form.signature_path, published: form.published,
        updated_at: new Date().toISOString(),
      }).eq("id", 1).select("id").single();
      if (saveError || !saved) throw saveError;
      await Promise.all([qc.invalidateQueries({ queryKey: ["president-editor"] }), qc.invalidateQueries({ queryKey: ["president-public"] })]);
      toast.success(form.published ? "Message enregistré et publié." : "Message enregistré et dépublié.");
    } catch { toast.error("Enregistrement impossible. Vos modifications restent dans le formulaire."); }
    finally { setBusy(false); }
  };

  return <form onSubmit={save} className="max-w-5xl space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold md:text-3xl">Le mot du Président</h1><Button asChild variant="outline" size="sm"><Link to="/mot-du-president" target="_blank"><ExternalLink />Voir la page</Link></Button></div>
    <div className="flex items-center gap-3 border-y py-4"><Switch id="president-published" checked={form.published} onCheckedChange={(published) => setForm({ ...form, published })} disabled={busy} /><Label htmlFor="president-published">{form.published ? "Message publié" : "Message dépublié"}</Label></div>
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      <section className="space-y-6">
        <div className="space-y-3"><Label htmlFor="president-photo">Photographie du Président</Label><MediaPreview path={form.photo_path} /><Input id="president-photo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => upload(e.target.files?.[0], "photo_path")} /></div>
        <div className="space-y-3"><Label htmlFor="president-signature">Signature</Label><MediaPreview path={form.signature_path} signature /><Input id="president-signature" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => upload(e.target.files?.[0], "signature_path")} />{form.signature_path && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setForm({ ...form, signature_path: null })}><Trash2 />Retirer la signature</Button>}</div>
      </section>
      <section className="space-y-5">
        <div className="space-y-2"><Label htmlFor="president-name">Nom du Président</Label><Input id="president-name" value={form.name} required maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="president-role">Fonction</Label><Input id="president-role" value={form.role_label} required maxLength={300} onChange={(e) => setForm({ ...form, role_label: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="president-body">Texte du Président</Label><Textarea id="president-body" value={form.body} required rows={20} maxLength={20000} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
      </section>
    </div>
    <Button disabled={busy} type="submit"><Save />{busy ? "Enregistrement…" : "Enregistrer les modifications"}</Button>
  </form>;
}