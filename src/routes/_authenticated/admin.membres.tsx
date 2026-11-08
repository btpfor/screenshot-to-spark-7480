import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileUp, KeyRound, MoreHorizontal, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MemberPhoto } from "@/components/MemberPhoto";
import { ScaledCard } from "@/components/MemberCardDialog";
import { createMember, importMembers, resetMemberPassword, setAccountStatus } from "@/lib/members.functions";
import { dateFr, downloadCsv, parseCsv } from "@/lib/format";
import { useAuth, CAN } from "@/lib/auth";
import { memberIdentifierFromCni } from "@/lib/member-ids";
import { normalizeCni } from "@/lib/member-duplicates";

export const Route = createFileRoute("/_authenticated/admin/membres")({
  head: () => ({ meta: [
    { title: "Gestion des membres — GIE VIP BOK GUIS GUIS" },
    { name: "description", content: "Administration des comptes et identifiants des membres du GIE VIP BOK GUIS GUIS." },
    { property: "og:title", content: "Gestion des membres — GIE VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Gestion des membres et de leurs accès personnels." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Members,
});

type Creds = { title: string; list: { name: string; matricule: string; password: string }[] };

const STATUS_STYLE: Record<string, string> = {
  actif: "bg-success/15 text-success", inactif: "bg-muted text-muted-foreground", suspendu: "bg-warning/20 text-accent-foreground",
};

function Members() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const manager = can(CAN.manageDrivers);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [view, setView] = useState<string | null>(null);
  const reset = useServerFn(resetMemberPassword);
  const setStatus = useServerFn(setAccountStatus);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => (await supabase.from("drivers").select("*").order("matricule")).data ?? [],
  });
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return drivers;
    return drivers.filter((d) => [d.matricule, d.first_name, d.last_name, d.phone].some((v) => v?.toLowerCase().includes(s)));
  }, [drivers, q]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["drivers"] });

  const act = async (id: string, status: "actif" | "inactif" | "suspendu", account: "actif" | "desactive" | "bloque") => {
    try { await setStatus({ data: { driverId: id, status, account } }); toast.success("Compte mis à jour"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const doReset = async (id: string, name: string) => {
    try { const r = await reset({ data: { driverId: id } }); setCreds({ title: "Mot de passe réinitialisé", list: [{ name, ...r }] }); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const selected = drivers.find((d) => d.id === view);

  const memberActions = (d: DriverRow) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setView(d.id)}>Voir le profil</DropdownMenuItem>
                      {manager && <>
                        <DropdownMenuItem onClick={() => doReset(d.id, `${d.first_name} ${d.last_name}`)}>Réinitialiser le mot de passe</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => act(d.id, "actif", "actif")}>Réactiver</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => act(d.id, "inactif", "desactive")}>Désactiver</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => act(d.id, "suspendu", "actif")}>Suspendre</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => act(d.id, "suspendu", "bloque")}>Bloquer le compte</DropdownMenuItem>
                      </>}
                    </DropdownMenuContent>
                  </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Gestion des membres</h1>
          <p className="text-sm text-muted-foreground">{drivers.length} membres enregistrés</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button variant="outline" onClick={() => downloadCsv("membres.csv", drivers.map((d) => ({
            matricule: d.matricule, prenom: d.first_name, nom: d.last_name, telephone: d.phone, adhesion: d.join_date, statut: d.status, plateforme: d.platform,
          })))}><Download className="mr-1 h-4 w-4" /> Exporter</Button>
          {manager && <Button variant="outline" onClick={() => setImporting(true)}><FileUp className="mr-1 h-4 w-4" /> Importer</Button>}
          {manager && <Button className="col-span-2" onClick={() => setAdding(true)}><Plus className="mr-1 h-4 w-4" /> Ajouter un membre</Button>}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Matricule, nom ou téléphone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.map((d) => <article key={d.id} className="min-w-0 rounded-lg border bg-card p-4 shadow-card">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"><div className="flex min-w-0 items-center gap-3"><MemberPhoto path={d.photo_url} className="h-11 w-11 shrink-0" /><div className="min-w-0"><h2 className="break-words font-semibold">{d.first_name} {d.last_name}</h2><p className="break-all font-mono text-xs">{d.matricule}</p></div></div>{memberActions(d)}</div>
          <div className="my-3 flex flex-wrap gap-2"><Badge variant="outline">{d.status}</Badge><Badge variant={d.account_status === "bloque" ? "destructive" : "secondary"}>{d.account_status}</Badge></div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm"><dt>Téléphone</dt><dd className="break-words">{d.phone}</dd><dt>Adhésion</dt><dd>{dateFr(d.join_date)}</dd><dt>Connexion</dt><dd className="break-words">{d.last_login_at ? new Date(d.last_login_at).toLocaleString("fr-FR") : "Jamais"}</dd></dl>
          <Button className="mt-3 w-full" variant="outline" onClick={() => setView(d.id)}>Voir le profil</Button>
        </article>)}
        {filtered.length === 0 && <p className="py-8 text-center text-muted-foreground">Aucun membre.</p>}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>{["Photo", "Matricule", "Prénom", "Nom", "Téléphone", "Adhésion", "Statut", "Dernière connexion", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-muted/30">
                <td className="px-4 py-2"><MemberPhoto path={d.photo_url} className="h-9 w-9" /></td>
                <td className="px-4 py-2 font-mono text-xs font-semibold">{d.matricule}</td>
                <td className="px-4 py-2">{d.first_name}</td>
                <td className="px-4 py-2">{d.last_name}</td>
                <td className="px-4 py-2">{d.phone}</td>
                <td className="px-4 py-2">{dateFr(d.join_date)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[d.status] ?? ""}`}>{d.status}</span>
                  {d.account_status === "bloque" && <Badge variant="destructive" className="ml-1">bloqué</Badge>}
                  {d.account_status === "desactive" && <Badge variant="outline" className="ml-1">désactivé</Badge>}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{d.last_login_at ? new Date(d.last_login_at).toLocaleString("fr-FR") : "Jamais"}</td>
                <td className="px-4 py-2 text-right">
                  {memberActions(d)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Aucun membre.</td></tr>}
          </tbody>
        </table>
      </div>

      {adding && <AddMember onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); setCreds(c); refresh(); }} />}
      {importing && <ImportMembers onClose={() => setImporting(false)} onDone={(c) => { setImporting(false); setCreds(c); refresh(); }} />}
      {selected && <Profile driver={selected} onClose={() => setView(null)} />}

      <Dialog open={!!creds} onOpenChange={() => setCreds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> {creds?.title}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Communiquez ces identifiants au chauffeur par un canal sécurisé. Le mot de passe ne sera plus affiché ; il devra être changé à la première connexion.</p>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {creds?.list.map((c) => (
              <div key={c.matricule} className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-semibold">{c.name}</div>
                <div>Identifiant : <span className="break-all font-mono font-bold">{c.matricule}</span></div>
                <div>Mot de passe : <span className="break-all font-mono font-bold">{c.password}</span></div>
              </div>
            ))}
          </div>
          <DialogFooter>
            {creds && creds.list.length > 1 && <Button variant="outline" onClick={() => downloadCsv("identifiants.csv", creds.list)}>Télécharger</Button>}
            <Button onClick={() => setCreds(null)}>J'ai noté les identifiants</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, defaultValue }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return <div className="space-y-1.5"><Label htmlFor={name}>{label}{required && " *"}</Label><Input id={name} name={name} type={type} required={required} defaultValue={defaultValue} /></div>;
}

function AddMember({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Creds) => void }) {
  const create = useServerFn(createMember);
  const [busy, setBusy] = useState(false);
  const [cni, setCni] = useState("");
  const [error, setError] = useState<string | null>(null);
  let identifier = "";
  try { identifier = memberIdentifierFromCni(cni); } catch { /* Incomplete number. */ }
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    setError(null);
    setBusy(true);
    try {
      let photo_url: string | null = null;
      const file = f.get("photo") as File | null;
      if (file && file.size) {
        const path = `${crypto.randomUUID()}.${file.name.split(".").pop()}`;
        const { error } = await supabase.storage.from("photos").upload(path, file);
        if (error) throw error;
        photo_url = path;
      }
      const r = await create({ data: {
        first_name: g("first_name"), last_name: g("last_name"), phone: g("phone"), address: g("address"), cni_number: g("cni_number"),
        birth_date: g("birth_date"), join_date: g("join_date"), platform: g("platform") || "Yango",
        status: g("status") as "actif", license_number: g("license_number"), license_expiry: g("license_expiry"), photo_url,
        allow_shared_phone: f.get("allow_shared_phone") === "on",
        vehicle: { brand: g("v_brand"), model: g("v_model"), plate: g("v_plate") },
      } });
      onCreated({ title: "Membre créé", list: [{ name: `${g("first_name")} ${g("last_name")}`, matricule: r.matricule, password: r.password }] });
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Ajouter un membre</DialogTitle></DialogHeader>
        <form onSubmit={submit} onChange={() => setError(null)} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Prénom" name="first_name" required />
            <Field label="Nom" name="last_name" required />
            <Field label="Téléphone" name="phone" type="tel" required />
            <Field label="Adresse" name="address" />
            <div className="space-y-1.5"><Label htmlFor="cni_number">Numéro de carte d’identité *</Label><Input id="cni_number" name="cni_number" required minLength={3} maxLength={40} pattern="[A-Za-z0-9]{3,40}" value={cni} onChange={(e) => setCni(e.target.value)} /></div>
            <Field label="Date de naissance" name="birth_date" type="date" />
            <Field label="Date d'adhésion" name="join_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            <div className="space-y-1.5"><Label htmlFor="matricule">Identifiant</Label><Input id="matricule" readOnly value={identifier} placeholder="vipbgg-123" /></div>
            <div className="space-y-1.5"><Label htmlFor="platform">Plateforme</Label>
              <select id="platform" name="platform" className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option>Yango</option><option>Heetch</option><option>Taxi traditionnel</option><option>Autre</option></select></div>
            <div className="space-y-1.5"><Label htmlFor="status">Statut</Label>
              <select id="status" name="status" className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option value="actif">Actif</option><option value="inactif">Inactif</option><option value="suspendu">Suspendu</option></select></div>
            <Field label="Numéro de permis" name="license_number" />
            <Field label="Validité du permis" name="license_expiry" type="date" />
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="photo">Photo de profil</Label><Input id="photo" name="photo" type="file" accept="image/*" /></div>
          </div>
          <fieldset className="rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Véhicule (facultatif)</legend>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Marque" name="v_brand" /><Field label="Modèle" name="v_model" /><Field label="Immatriculation" name="v_plate" /></div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_shared_phone" /> Autoriser exceptionnellement un téléphone déjà utilisé</label>
          {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button disabled={busy}>{busy ? "Création…" : "Créer le membre et son compte"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Row = { first_name: string; last_name: string; phone: string; matricule?: string | undefined; address?: string | undefined; cni_number?: string | undefined; platform: string; birth_date?: string | undefined; join_date?: string | undefined; status: "actif" };

function ImportMembers({ onClose, onDone }: { onClose: () => void; onDone: (c: Creds) => void }) {
  const run = useServerFn(importMembers);
  const [rows, setRows] = useState<(Row & { error?: string })[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async (file: File) => {
    const raw = parseCsv(await file.text());
    const seenPhone = new Set<string>(), seenMat = new Set<string>(), seenCni = new Set<string>();
    setRows(raw.map((r) => {
      const row: Row & { error?: string } = {
        first_name: r["prenom"] ?? r["prénom"] ?? "", last_name: r["nom"] ?? "", phone: (r["telephone"] ?? r["téléphone"] ?? "").replace(/\s/g, ""),
        address: r["adresse"], cni_number: r["cni"]?.trim() ?? "", platform: r["plateforme"] || "Yango",
        birth_date: r["naissance"] || undefined, join_date: r["adhesion"] || undefined, status: "actif",
      };
      try { row.matricule = memberIdentifierFromCni(row.cni_number ?? ""); }
      catch { row.error = "Numéro CNI manquant ou invalide"; }
      if (!row.first_name || !row.last_name) row.error = "Nom ou prénom manquant";
      else if (!/^\+?[0-9]{7,20}$/.test(row.phone)) row.error = "Téléphone invalide";
      else if (row.cni_number && seenCni.has(normalizeCni(row.cni_number))) row.error = "CNI en double dans le fichier";
      else if (row.matricule && seenMat.has(row.matricule.toUpperCase())) row.error = `L’identifiant ${row.matricule} est déjà généré par une autre CNI du fichier`;
      else if (seenPhone.has(row.phone)) row.error = "Téléphone en double dans le fichier";
      seenPhone.add(row.phone); if (row.matricule) seenMat.add(row.matricule.toUpperCase());
      if (row.cni_number) seenCni.add(normalizeCni(row.cni_number));
      return row;
    }));
  };
  const valid = rows.filter((r) => !r.error);
  const confirm = async () => {
    setBusy(true);
    try {
      const res = await run({ data: { rows: valid.map(({ error: _e, ...r }) => ({ ...r, cni_number: r.cni_number ?? "" })) } });
      const failed = res.filter((r) => !r.ok);
      if (failed.length) toast.error(`${failed.length} ligne(s) refusée(s) : ${failed.map((f) => `${f.name} (${f.error})`).join(", ")}`, { duration: 15000 });
      onDone({ title: `${res.length - failed.length} membre(s) importé(s)`, list: res.flatMap((r) => r.ok && r.matricule && r.password ? [{ name: r.name, matricule: r.matricule, password: r.password }] : []) });
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Importer des membres</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Colonnes obligatoires : <b>prenom, nom, telephone, cni</b>. Facultatives : adresse, plateforme, naissance, adhesion.
        </p>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => downloadCsv("modele-import.csv", [{ prenom: "", nom: "", telephone: "", adresse: "", cni: "", plateforme: "Yango", naissance: "", adhesion: "" }])}>Télécharger le modèle</Button>
        <Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        {rows.length > 0 && (
          <>
            <div className="text-sm"><b>{valid.length}</b> ligne(s) valide(s), <b className="text-destructive">{rows.length - valid.length}</b> erreur(s)</div>
            <div className="max-h-64 overflow-auto rounded border text-xs">
              <table className="w-full min-w-[560px]">
                <tbody className="divide-y">{rows.map((r, i) => (
                  <tr key={i} className={r.error ? "bg-destructive/10" : ""}>
                    <td className="px-2 py-1">{i + 2}</td><td className="px-2 py-1">{r.first_name} {r.last_name}</td><td className="px-2 py-1">{r.phone}</td>
                    <td className="px-2 py-1">{r.matricule ?? "auto"}</td><td className="px-2 py-1 text-destructive">{r.error}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuler</Button><Button disabled={busy || !valid.length} onClick={confirm}>{busy ? "Création…" : `Créer ${valid.length} compte(s)`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];
function Profile({ driver: d, onClose }: { driver: DriverRow; onClose: () => void }) {
  const { data: history = [] } = useQuery({
    queryKey: ["history", d.id],
    queryFn: async () => (await supabase.from("audit_log").select("*").eq("record_id", d.id).order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  const rows: [string, string][] = [
    ["Matricule", d.matricule], ["Téléphone", d.phone], ["Adresse", d.address ?? "—"], ["CNI", d.cni_number ?? "—"],
    ["Naissance", dateFr(d.birth_date)], ["Adhésion", dateFr(d.join_date)], ["Plateforme", d.platform], ["Permis", `${d.license_number ?? "—"} (valide jusqu'au ${dateFr(d.license_expiry)})`],
    ["Statut", d.status], ["Compte", d.account_status], ["Mot de passe", d.must_change_password ? "Temporaire (à changer)" : "Personnalisé"],
  ];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{d.first_name} {d.last_name}</DialogTitle></DialogHeader>
        <MemberPhoto path={d.photo_url} className="h-20 w-20" />
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-3 sm:gap-y-2">{rows.map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words pb-2 sm:col-span-2 sm:pb-0">{v}</dd></Fragment>)}</dl>
        <h3 className="mt-2 font-semibold">Carte de membre</h3>
        <ScaledCard member={d} />
        <h3 className="mt-2 font-semibold">Historique</h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {history.length === 0 && <li>Aucune opération visible.</li>}
          {history.map((h) => <li key={h.id}>{new Date(h.created_at).toLocaleString("fr-FR")} — {h.action}</li>)}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
