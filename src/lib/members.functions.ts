import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { matriculeToEmail, genTempPassword, memberIdentifierFromCni } from "./member-ids";
import { conflictFromDatabaseError, findMemberConflict, memberConflictMessage, normalizeCni } from "./member-duplicates";

export const MANAGERS = ["super_admin", "president", "secretaire", "resp_chauffeurs"] as const;

export async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function assertManager(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_any_role", { _user_id: ctx.userId, _roles: [...MANAGERS] });
  if (!data) throw new Error("Accès refusé");
}

/* ---------- Bootstrap: first super admin (only when none exists) ---------- */
export const hasSuperAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const a = await admin();
  const { count } = await a.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
  return (count ?? 0) > 0;
});

export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().email(), password: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const a = await admin();
    const { count } = await a.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) > 0) throw new Error("Un administrateur existe déjà.");
    const { data: u, error } = await a.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true, user_metadata: { must_change_password: true } });
    if (error || !u.user) {
      if (error?.code === "weak_password") throw new Error("Ce mot de passe est trop facile à deviner ou déjà compromis. Choisissez un autre mot de passe pour sécuriser le compte administrateur.");
      throw new Error(error?.message ?? "Création impossible");
    }
    const { error: roleError } = await a.from("user_roles").insert({ user_id: u.user.id, role: "super_admin" });
    if (roleError) {
      await a.auth.admin.deleteUser(u.user.id);
      throw new Error("Attribution du rôle impossible. Réessayez.");
    }
    return { ok: true };
  });

/* ---------- Member creation ---------- */
export const memberSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^\+?[0-9 ]{7,20}$/, "Téléphone invalide"),
  address: z.string().max(200).optional().nullable(),
  cni_number: z.string().trim().min(3).max(40).regex(/^[a-z0-9]+$/i, "Numéro de carte d’identité invalide"),
  birth_date: z.string().optional().nullable(),
  join_date: z.string().optional().nullable(),
  matricule: z.string().trim().max(30).optional().nullable(),
  platform: z.string().max(40).default("Yango"),
  status: z.enum(["actif", "inactif", "suspendu"]).default("actif"),
  license_number: z.string().max(40).optional().nullable(),
  license_expiry: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  allow_shared_phone: z.boolean().default(false),
  password: z.string().trim().regex(/^\d{6}$/, "Le mot de passe provisoire doit contenir exactement 6 chiffres.").optional().nullable().or(z.literal("")),
  vehicle: z.object({ brand: z.string(), model: z.string(), plate: z.string() }).partial().optional().nullable(),
});
export type MemberInput = z.infer<typeof memberSchema>;

export async function createOne(a: Awaited<ReturnType<typeof admin>>, m: MemberInput) {
  const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);
  const identifier = memberIdentifierFromCni(m.cni_number);
  const conflict = await findMemberConflict(m.cni_number, identifier, async (field, value) => {
    const { data, error } = await a.from("drivers").select("id").ilike(field, value).limit(1);
    if (error) throw new Error("Impossible de vérifier les doublons. Réessayez avant de créer le membre.");
    return (data?.length ?? 0) > 0;
  });
  if (conflict) throw new Error(memberConflictMessage(conflict, identifier));
  const row: Record<string, unknown> = {
    first_name: m.first_name, last_name: m.last_name, phone: m.phone.replace(/\s/g, ""),
    address: clean(m.address), cni_number: normalizeCni(m.cni_number), birth_date: clean(m.birth_date),
    license_number: clean(m.license_number), license_expiry: clean(m.license_expiry),
    platform: m.platform || "Yango", status: m.status, photo_url: clean(m.photo_url),
    allow_shared_phone: m.allow_shared_phone, must_change_password: true,
  };
  if (clean(m.join_date)) row["join_date"] = clean(m.join_date);
  row["matricule"] = identifier;

  const { data: d, error } = await a.from("drivers").insert(row as never).select("id, matricule").single();
  if (error) {
    const conflict = conflictFromDatabaseError(error);
    if (conflict) throw new Error(memberConflictMessage(conflict, identifier));
    if (error.message.includes("phone")) throw new Error("Ce numéro de téléphone est déjà utilisé.");
    throw new Error(error.message);
  }
  const password = m.password && m.password.trim() ? m.password.trim() : genTempPassword();
  const { data: u, error: ue } = await a.auth.admin.createUser({
    email: matriculeToEmail(d.matricule), password, email_confirm: true,
    user_metadata: { matricule: d.matricule, must_change_password: true },
  });
  if (ue || !u.user) {
    await a.from("drivers").delete().eq("id", d.id);
    if (ue?.code === "weak_password") throw new Error("Ce mot de passe provisoire est trop facile à deviner (ex. 123456). Choisissez 6 autres chiffres.");
    throw new Error(ue?.message ?? "Création du compte impossible");
  }
  const { error: linkError } = await a.from("drivers").update({ user_id: u.user.id }).eq("id", d.id);
  const { error: roleError } = linkError ? { error: linkError } : await a.from("user_roles").upsert({ user_id: u.user.id, role: "chauffeur" }, { onConflict: "user_id,role" });
  if (roleError) {
    await a.auth.admin.deleteUser(u.user.id);
    await a.from("drivers").delete().eq("id", d.id);
    throw new Error("Création de l’accès membre impossible. Réessayez.");
  }
  const v = m.vehicle;
  if (v?.plate && v.brand && v.model) {
    await a.from("vehicles").insert({ brand: v.brand, model: v.model, plate: v.plate.toUpperCase(), driver_id: d.id, status: "en_circulation" });
  }
  return { id: d.id, matricule: d.matricule, password };
}

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => memberSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context);
    return createOne(await admin(), data);
  });

export type ImportResult = { line: number; ok: boolean; matricule?: string; password?: string; name: string; error?: string };

export async function importMemberRows(a: Awaited<ReturnType<typeof admin>>, rows: MemberInput[]): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  for (const [i, r] of rows.entries()) {
    try {
      const res = await createOne(a, r);
      results.push({ line: i + 2, ok: true, matricule: res.matricule, password: res.password, name: `${r.first_name} ${r.last_name}` });
    } catch (e) {
      results.push({ line: i + 2, ok: false, name: `${r.first_name} ${r.last_name}`, error: (e as Error).message });
    }
  }
  return results;
}

export const importMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rows: z.array(memberSchema).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context);
    return importMemberRows(await admin(), data.rows);
  });

/* ---------- Account actions ---------- */
export async function resetPasswordFor(a: Awaited<ReturnType<typeof admin>>, driverId: string, actorId: string) {
  const { data: d } = await a.from("drivers").select("user_id, matricule").eq("id", driverId).single();
  if (!d?.user_id) throw new Error("Compte introuvable");
  const password = genTempPassword();
  const { error } = await a.auth.admin.updateUserById(d.user_id, { password });
  if (error) throw new Error(error.message);
  await a.from("drivers").update({ must_change_password: true }).eq("id", driverId);
  await a.from("audit_log").insert({ user_id: actorId, action: "RESET_PASSWORD", table_name: "drivers", record_id: driverId });
  return { matricule: d.matricule, password };
}

export async function setStatusFor(
  a: Awaited<ReturnType<typeof admin>>,
  driverId: string,
  status: "actif" | "inactif" | "suspendu",
  account: "actif" | "desactive" | "bloque",
  actorId: string,
) {
  const { data: d } = await a.from("drivers").select("user_id").eq("id", driverId).single();
  if (d?.user_id) {
    await a.auth.admin.updateUserById(d.user_id, { ban_duration: account === "actif" ? "none" : "876000h" });
  }
  await a.from("drivers").update({ status, account_status: account }).eq("id", driverId);
  await a.from("audit_log").insert({ user_id: actorId, action: `ACCOUNT_${account.toUpperCase()}`, table_name: "drivers", record_id: driverId });
  return { ok: true };
}

export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ driverId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context);
    return resetPasswordFor(await admin(), data.driverId, context.userId);
  });

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ driverId: z.string().uuid(), status: z.enum(["actif", "inactif", "suspendu"]), account: z.enum(["actif", "desactive", "bloque"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context);
    return setStatusFor(await admin(), data.driverId, data.status, data.account, context.userId);
  });
