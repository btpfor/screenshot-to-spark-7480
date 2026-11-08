import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Car, TrendingDown, TrendingUp, UserCheck, UserX, Users, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fcfa, daysUntil } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [
    { title: "Tableau de bord — GIE VIP BOK GUIS GUIS" },
    { name: "description", content: "Suivi des membres, véhicules et finances du GIE." },
    { property: "og:title", content: "Tableau de bord — GIE VIP BOK GUIS GUIS" },
    { property: "og:description", content: "Suivi de l’activité du GIE." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Dashboard,
});

const STATUS_LABEL: Record<string, string> = {
  disponible: "Disponible", en_circulation: "En circulation", maintenance: "Maintenance",
  immobilise: "Immobilisé", financement: "Financement", vendu: "Vendu",
};

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [d, v, t] = await Promise.all([
        supabase.from("drivers").select("status"),
        supabase.from("vehicles").select("status, plate, insurance_expiry, inspection_expiry, next_maintenance"),
        supabase.from("transactions").select("kind, amount, paid_at, status"),
      ]);
      return { drivers: d.data ?? [], vehicles: v.data ?? [], tx: t.data ?? [] };
    },
  });
  const drivers = data?.drivers ?? [], vehicles = data?.vehicles ?? [], tx = data?.tx ?? [];
  const paid = tx.filter((t) => t.status === "paye");
  const cotis = paid.filter((t) => t.kind.startsWith("cotisation") || t.kind === "contribution_exceptionnelle").reduce((s, t) => s + Number(t.amount), 0);
  const recettes = paid.filter((t) => t.kind === "recette").reduce((s, t) => s + Number(t.amount), 0);
  const depenses = paid.filter((t) => t.kind === "depense").reduce((s, t) => s + Number(t.amount), 0);
  const dettes = tx.filter((t) => t.status === "impaye").reduce((s, t) => s + Number(t.amount), 0);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    const key = d.toISOString().slice(0, 7);
    const m = paid.filter((t) => t.paid_at.startsWith(key));
    return {
      mois: d.toLocaleDateString("fr-FR", { month: "short" }),
      Entrées: m.filter((t) => t.kind !== "depense" && t.kind !== "dette").reduce((s, t) => s + Number(t.amount), 0),
      Dépenses: m.filter((t) => t.kind === "depense").reduce((s, t) => s + Number(t.amount), 0),
    };
  });
  const byStatus = Object.entries(vehicles.reduce<Record<string, number>>((a, v) => ({ ...a, [v.status]: (a[v.status] ?? 0) + 1 }), {}))
    .map(([k, n]) => ({ name: STATUS_LABEL[k] ?? k, value: n }));
  const alerts = vehicles.flatMap((v) => [
    ["Assurance", v.insurance_expiry], ["Visite technique", v.inspection_expiry], ["Entretien", v.next_maintenance],
  ].filter(([, d]) => { const n = daysUntil(d as string); return n !== null && n <= 30; })
    .map(([label, d]) => ({ plate: v.plate, label: label as string, days: daysUntil(d as string)! })));

  const stats = [
    { label: "Chauffeurs inscrits", value: drivers.length, icon: Users },
    { label: "Chauffeurs actifs", value: drivers.filter((d) => d.status === "actif").length, icon: UserCheck },
    { label: "Chauffeurs inactifs", value: drivers.filter((d) => d.status !== "actif").length, icon: UserX },
    { label: "Véhicules enregistrés", value: vehicles.length, icon: Car },
    { label: "Véhicules disponibles", value: vehicles.filter((v) => v.status === "disponible").length, icon: Car },
    { label: "Véhicules en financement", value: vehicles.filter((v) => v.status === "financement").length, icon: Car },
  ];
  const money = [
    { label: "Cotisations collectées", value: cotis, icon: Wallet },
    { label: "Total des dépenses", value: depenses, icon: TrendingDown },
    { label: "Situation financière", value: cotis + recettes - depenses, icon: TrendingUp },
    { label: "Dettes en cours", value: dettes, icon: AlertTriangle },
  ];
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble des activités du GIE</p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 break-words rounded-lg border bg-card p-4 shadow-card">
            <s.icon className="h-4 w-4 text-primary" />
            <div className="mt-3 font-display text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {money.map((s, i) => (
          <div key={s.label} className={`min-w-0 break-words rounded-lg p-5 shadow-card ${i === 2 ? "bg-primary text-primary-foreground" : "border bg-card"}`}>
            <div className="flex items-center justify-between text-xs opacity-80">{s.label}<s.icon className="h-4 w-4" /></div>
            <div className="mt-3 font-display text-xl font-bold">{fcfa(s.value)}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 break-words rounded-lg border bg-card p-5 shadow-card lg:col-span-2">
          <h3 className="mb-4 font-semibold">Entrées et dépenses — 6 derniers mois</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={months}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mois" fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => fcfa(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="Entrées" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dépenses" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="min-w-0 break-words rounded-lg border bg-card p-5 shadow-card">
          <h3 className="mb-4 font-semibold">Parc par statut</h3>
          {byStatus.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {byStatus.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-muted-foreground">Aucun véhicule enregistré.</p>}
        </div>
      </div>
      <div className="min-w-0 break-words rounded-lg border bg-card p-5 shadow-card">
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> Alertes véhicules (30 jours)</h3>
        {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Aucune échéance proche.</p> : (
          <ul className="divide-y text-sm">
            {alerts.map((a, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2">
                <span><b>{a.plate}</b> — {a.label}</span>
                <span className={a.days < 0 ? "font-semibold text-destructive" : "text-warning"}>{a.days < 0 ? `expiré depuis ${-a.days} j` : `dans ${a.days} j`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
