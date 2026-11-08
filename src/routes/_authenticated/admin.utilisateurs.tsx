import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, KeyRound, Pencil, Plus, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth, ROLE_LABELS, ROLE_PERMISSIONS, type AppRole } from "@/lib/auth";
import { createStaffAccount, listAppUsers, setUserRoles } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/admin/utilisateurs")({
  head: () => ({ meta: [
    { title: "Utilisateurs et rôles — GIE VIP BOK GUIS GUIS" },
    { name: "description", content: "Gestion des comptes du personnel et de leurs rôles au GIE." },
    { property: "og:title", content: "Utilisateurs et rôles — GIE VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Administration des accès du personnel." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: UsersPage,
});

const ALL_ROLES = Object.keys(ROLE_LABELS) as AppRole[];

function UsersPage() {
  const { roles: myRoles, loading } = useAuth();
  const isSuper = myRoles.includes("super_admin");
  const qc = useQueryClient();
  const list = useServerFn(listAppUsers);
  const [q, setQ] = useState("");
  const [staffOnly, setStaffOnly] = useState(true);
  const [editing, setEditing] = useState<{ id: string; label: string; roles: AppRole[] } | null>(null);
  const [creating, setCreating] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  const { data: users = [], isLoading } = useQuery({ queryKey: ["app-users"], queryFn: () => list(), enabled: isSuper });
  const filtered = useMemo(() => users.filter((u) => {
    if (staffOnly && !u.roles.some((r) => r !== "chauffeur")) return false;
    const s = q.trim().toLowerCase();
    return !s || [u.email, u.name, u.matricule ?? ""].some((v) => v.toLowerCase().includes(s));
  }), [users, q, staffOnly]);

  if (loading) return null;
  if (!isSuper) return <p className="text-muted-foreground">Cette page est réservée au super administrateur.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Utilisateurs & rôles</h1>
          <p className="text-sm text-muted-foreground">Attribuez les fonctions du personnel et leurs permissions.</p>
        </div>
        <Button className="h-auto min-h-11 w-full whitespace-normal sm:w-auto" onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" /> Nouveau membre du personnel</Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Nom, email ou matricule" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={staffOnly} onChange={(e) => setStaffOnly(e.target.checked)} /> Personnel uniquement</label>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading && <p>Chargement…</p>}
        {filtered.map((u) => <article key={u.id} className="min-w-0 rounded-lg border bg-card p-4 shadow-card"><h2 className="break-words font-semibold">{u.name || "—"}</h2><p className="mt-2 break-all font-mono text-xs">{u.matricule ?? u.email}</p><div className="my-3 flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r}>{ROLE_LABELS[r]}</Badge>)}</div><p className="text-xs text-muted-foreground">Dernière connexion : {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("fr-FR") : "Jamais"}</p><Button className="mt-3 w-full" variant="outline" onClick={() => setEditing({ id: u.id, label: u.name || u.email, roles: u.roles })}><Pencil />Rôles</Button></article>)}
        {!isLoading && filtered.length === 0 && <p>Aucun utilisateur.</p>}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>{["Utilisateur", "Identifiant", "Rôles", "Dernière connexion", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>}
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.name || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{u.matricule ?? u.email}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">
                  {u.roles.length === 0 && <span className="text-xs text-muted-foreground">Aucun</span>}
                  {u.roles.map((r) => <Badge key={r} variant={r === "super_admin" ? "default" : r === "chauffeur" ? "outline" : "secondary"}>{ROLE_LABELS[r]}</Badge>)}
                </div></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("fr-FR") : "Jamais"}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ id: u.id, label: u.name || u.email, roles: u.roles })}><Pencil className="mr-1 h-3.5 w-3.5" /> Rôles</Button>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Aucun utilisateur.</td></tr>}
          </tbody>
        </table>
      </div>

      <PermissionsMatrix />

      {editing && <EditRoles user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["app-users"] }); }} />}
      {creating && <CreateStaff onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); setCreds(c); qc.invalidateQueries({ queryKey: ["app-users"] }); }} />}

      <Dialog open={!!creds} onOpenChange={() => setCreds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Compte créé</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Transmettez ces identifiants par un canal sécurisé. Le mot de passe ne sera plus affiché.</p>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div>Email : <span className="break-all font-mono font-bold">{creds?.email}</span></div>
            <div>Mot de passe : <span className="break-all font-mono font-bold">{creds?.password}</span></div>
          </div>
          <DialogFooter><Button onClick={() => setCreds(null)}>J'ai noté les identifiants</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RolePicker({ value, onChange }: { value: AppRole[]; onChange: (r: AppRole[]) => void }) {
  return (
    <div className="space-y-2">
      {ALL_ROLES.map((r) => {
        const on = value.includes(r);
        return (
          <button type="button" key={r} onClick={() => onChange(on ? value.filter((x) => x !== r) : [...value, r])}
            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${on ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : ""}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
            <span>
              <span className="block text-sm font-semibold">{ROLE_LABELS[r]}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_PERMISSIONS[r]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EditRoles({ user, onClose, onSaved }: { user: { id: string; label: string; roles: AppRole[] }; onClose: () => void; onSaved: () => void }) {
  const save = useServerFn(setUserRoles);
  const [roles, setRoles] = useState<AppRole[]>(user.roles);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await save({ data: { userId: user.id, roles } }); toast.success("Rôles mis à jour"); onSaved(); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader><DialogTitle>Rôles de {user.label}</DialogTitle></DialogHeader>
        <RolePicker value={roles} onChange={setRoles} />
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={submit} disabled={busy}>Enregistrer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateStaff({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { email: string; password: string }) => void }) {
  const create = useServerFn(createStaffAccount);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roles.length) { toast.error("Choisissez au moins un rôle."); return; }
    setBusy(true);
    try { onCreated(await create({ data: { email, full_name: name, roles } })); }
    catch (err) { toast.error((err as Error).message); }
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader><DialogTitle>Nouveau membre du personnel</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="n">Nom complet</Label><Input id="n" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="e">Email (identifiant de connexion)</Label><Input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <RolePicker value={roles} onChange={setRoles} />
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button disabled={busy}>Créer le compte</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const MATRIX: { label: string; roles: AppRole[] }[] = [
  { label: "Voir le tableau de bord", roles: ["super_admin", "president", "secretaire", "tresorier", "resp_chauffeurs", "resp_parc", "resp_partenariats"] },
  { label: "Créer et modifier les membres", roles: ["super_admin", "president", "secretaire", "resp_chauffeurs"] },
  { label: "Supprimer des membres", roles: ["super_admin", "president"] },
  { label: "Gérer les véhicules", roles: ["super_admin", "president", "resp_parc"] },
  { label: "Enregistrer les cotisations et dépenses", roles: ["super_admin", "president", "tresorier"] },
  { label: "Consulter le journal d'audit", roles: ["super_admin", "president"] },
  { label: "Attribuer les rôles", roles: ["super_admin"] },
];

function PermissionsMatrix() {
  const cols = ALL_ROLES.filter((r) => r !== "chauffeur");
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <h2 className="mb-4 flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Permissions par rôle</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead><tr><th className="p-2 text-left" />{cols.map((r) => <th key={r} className="p-2 text-center font-semibold">{ROLE_LABELS[r]}</th>)}</tr></thead>
          <tbody className="divide-y">
            {MATRIX.map((m) => (
              <tr key={m.label}><td className="p-2 font-medium">{m.label}</td>
                {cols.map((r) => <td key={r} className="p-2 text-center">{m.roles.includes(r) ? <Check className="mx-auto h-4 w-4 text-success" /> : <span className="text-muted-foreground">—</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Le rôle Chauffeur donne uniquement accès à l'espace personnel. Ces permissions sont appliquées par la base de données.</p>
    </div>
  );
}
