export const fcfa = (n: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(Number(n ?? 0))) + " FCFA";

export const dateFr = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "—";

export const daysUntil = (d: string | null | undefined) =>
  d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const split = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}
