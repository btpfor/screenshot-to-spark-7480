import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Plus, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { canEditPresident } from "@/lib/president-rules";
import { bureauQuery } from "@/lib/bureau";

export const Route = createFileRoute("/_authenticated/admin/bureau")({
  head: () => ({ meta: [
    { title: "Gestion du bureau — VIP BOK GUIS GUIS" },
    { name: "description", content: "Gestion des membres du bureau dirigeant du GIE." },
    { property: "og:title", content: "Gestion du bureau — VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Gestion des membres du bureau dirigeant." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: BureauAdmin,
});

type MemberRow = {
  id: string;
  full_name: string | null;
  role_label: string;
  phone: string | null;
  photo_path: string | null;
  sort_order: number;
  published: boolean;
  contact_enabled: boolean;
};

async function uploadPhoto(file: File, prefix: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `bureau/${prefix}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("president-media").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

function BureauAdmin() {
  const { can, loading, roles } = useAuth();
  const qc = useQueryClient();
  const groupInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data, error: readError, isPending } = useQuery({
    queryKey: ["bureau-admin"],
    queryFn: async () => {
      const [s, m] = await Promise.all([
        supabase.from("bureau_settings").select("group_photo_path").eq("id", 1).single(),
        supabase.from("bureau_members").select("*").order("sort_order"),
      ]);
      if (s.error || m.error) throw s.error ?? m.error;
      return { groupPhotoPath: s.data?.group_photo_path ?? null, members: (m.data ?? []) as MemberRow[] };
    },
  });

  if (loading) return null;
  if (!canEditPresident(roles) && !can(["super_admin"])) {
    return <p className="text-muted-foreground">Accès réservé au Président, au Secrétaire général et au super administrateur.</p>;
  }
  if (isPending) return <p role="status" className="text-muted-foreground">Chargement du bureau…</p>;
  if (readError) return <div role="alert" className="space-y-3"><p>Impossible de charger le bureau. Veuillez réessayer.</p><Button variant="outline" onClick={() => void qc.invalidateQueries({ queryKey: ["bureau-admin"] })}>Réessayer</Button></div>;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["bureau-admin"] });
    await qc.invalidateQueries({ queryKey: bureauQuery.queryKey });
  };

  const changeGroupPhoto = async (file: File) => {
    setBusy(true);
    let uploaded: string | null = null;
    try {
      const path = await uploadPhoto(file, "groupe");
      uploaded = path;
      const { error } = await supabase.from("bureau_settings").update({ group_photo_path: path, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw error;
      uploaded = null;
      await refresh();
      toast.success("Photographie officielle du bureau mise à jour.");
    } catch (e) {
      if (uploaded) await supabase.storage.from("president-media").remove([uploaded]);
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const persistMember = async (m: MemberRow, patch: Partial<MemberRow>) => {
    const { error } = await supabase.from("bureau_members").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", m.id);
    if (error) throw error;
    await refresh();
  };

  const updateMember = async (m: MemberRow, patch: Partial<MemberRow>) => {
    setBusy(true);
    try { await persistMember(m, patch); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const addMember = async () => {
    const next = Math.max(0, ...(data?.members ?? []).map((m) => m.sort_order)) + 1;
    const { error } = await supabase.from("bureau_members").insert({ role_label: "Membre du bureau", sort_order: next, published: false });
    if (error) { toast.error(error.message); return; }
    await refresh();
    toast.success("Membre ajouté — complétez ses informations.");
  };

  const removeMember = async (m: MemberRow) => {
    if (!window.confirm(`Retirer « ${m.full_name || m.role_label} » du bureau ?`)) return;
    const { error } = await supabase.from("bureau_members").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    await refresh();
    toast.success("Membre retiré du bureau.");
  };

  const changeMemberPhoto = async (m: MemberRow, file: File) => {
    setBusy(true);
    let uploaded: string | null = null;
    try {
      const path = await uploadPhoto(file, "membre");
      uploaded = path;
      await persistMember(m, { photo_path: path });
      uploaded = null;
      toast.success("Photographie mise à jour.");
    } catch (e) {
      if (uploaded) await supabase.storage.from("president-media").remove([uploaded]);
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Gestion du bureau</h1>
        <p className="text-sm text-muted-foreground">Membres du bureau dirigeant — répercutés automatiquement sur la page publique « Les membres du Bureau ».</p>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-4 shadow-card sm:p-6">
        <h2 className="font-semibold">Photographie officielle du groupe</h2>
        <p className="text-sm text-muted-foreground">Affichée en grand format sur la page publique. L'originale fournie est utilisée par défaut.</p>
        <input ref={groupInput} type="file" accept="image/*" className="hidden" aria-label="Choisir la photographie officielle du groupe"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void changeGroupPhoto(f); e.target.value = ""; }} />
        <Button variant="outline" disabled={busy} onClick={() => groupInput.current?.click()}>
          <ImagePlus className="mr-1 h-4 w-4" /> {data?.groupPhotoPath ? "Remplacer la photographie" : "Ajouter la photographie"}
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Membres du bureau</h2>
           <Button size="sm" variant="outline" disabled={busy} onClick={addMember}><Plus className="mr-1 h-4 w-4" /> Ajouter un membre</Button>
        </div>
        {(data?.members ?? []).map((m) => (
          <MemberEditor key={m.id} member={m} busy={busy} onUpdate={updateMember} onPhoto={changeMemberPhoto} onRemove={removeMember} />
        ))}
      </section>
    </div>
  );
}

function MemberEditor({ member: m, busy, onUpdate, onPhoto, onRemove }: {
  member: MemberRow;
  busy: boolean;
  onUpdate: (m: MemberRow, patch: Partial<MemberRow>) => Promise<void>;
  onPhoto: (m: MemberRow, file: File) => Promise<void>;
  onRemove: (m: MemberRow) => Promise<void>;
}) {
  const photoInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ full_name: m.full_name ?? "", role_label: m.role_label, phone: m.phone ?? "", sort_order: m.sort_order });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    setForm({ full_name: m.full_name ?? "", role_label: m.role_label, phone: m.phone ?? "", sort_order: m.sort_order });
  }, [m.full_name, m.role_label, m.phone, m.sort_order]);
  useEffect(() => {
    if (!m.photo_path) { setPhotoUrl(null); return; }
    if (m.photo_path.startsWith("/__l5e/")) { setPhotoUrl(m.photo_path); return; }
    let active = true;
    supabase.storage.from("president-media").createSignedUrl(m.photo_path, 3600).then(({ data }) => { if (active) setPhotoUrl(data?.signedUrl ?? null); });
    return () => { active = false; };
  }, [m.photo_path]);

  const dirty = form.full_name !== (m.full_name ?? "") || form.role_label !== m.role_label || form.phone !== (m.phone ?? "") || form.sort_order !== m.sort_order;

  return (
    <div className="grid min-w-0 gap-3 border-b pb-5">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-gold/70 bg-muted">
          {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : <User className="h-7 w-7 text-muted-foreground" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input ref={photoInput} type="file" accept="image/*" className="hidden" aria-label={`Choisir la photographie de ${m.full_name || m.role_label}`}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPhoto(m, f); e.target.value = ""; }} />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => photoInput.current?.click()}><ImagePlus className="mr-1 h-4 w-4" /> Photo</Button>
          <label className="flex items-center gap-2 text-sm">
            <Switch disabled={busy} checked={m.published} onCheckedChange={(v) => void onUpdate(m, { published: v })} aria-label="Visible sur le site public" />
            Visible sur le site
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch disabled={busy} checked={m.contact_enabled} onCheckedChange={(v) => void onUpdate(m, { contact_enabled: v })} aria-label="Autoriser les boutons de contact" />
            Boutons de contact
          </label>
          <Button disabled={busy} size="sm" variant="ghost" className="ml-auto text-destructive" aria-label={`Retirer ${m.full_name || m.role_label}`} onClick={() => void onRemove(m)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1.5"><Label>Fonction officielle</Label><Input value={form.role_label} onChange={(e) => setForm({ ...form, role_label: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Nom et prénom</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Téléphone professionnel</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Ordre d'affichage</Label><Input type="number" min={1} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} /></div>
      </div>
      {dirty && (
        <Button disabled={busy} size="sm" className="w-fit" onClick={() => void onUpdate(m, { full_name: form.full_name.trim() || null, role_label: form.role_label.trim() || m.role_label, phone: form.phone.trim() || null, sort_order: form.sort_order })}>
          Enregistrer ce membre
        </Button>
      )}
    </div>
  );
}
