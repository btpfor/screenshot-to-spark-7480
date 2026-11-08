import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { genTempPassword } from "./member-ids";

const ROLES = ["super_admin", "president", "secretaire", "tresorier", "resp_chauffeurs", "resp_parc", "resp_partenariats", "chauffeur"] as const;

async function assertSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (!data) throw new Error("Accès réservé au super administrateur");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const a = await assertSuperAdmin(context);
    const { data, error } = await a.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);
    const [{ data: roles }, { data: drivers }] = await Promise.all([
      a.from("user_roles").select("user_id, role"),
      a.from("drivers").select("user_id, matricule, first_name, last_name"),
    ]);
    return data.users.map((u) => {
      const d = (drivers ?? []).find((x) => x.user_id === u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        name: d ? `${d.first_name} ${d.last_name}` : ((u.user_metadata?.["full_name"] as string | undefined) ?? ""),
        matricule: d?.matricule ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role),
      };
    });
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), roles: z.array(z.enum(ROLES)) }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await assertSuperAdmin(context);
    if (!data.roles.includes("super_admin")) {
      const { data: admins } = await a.from("user_roles").select("user_id").eq("role", "super_admin");
      const others = (admins ?? []).filter((r) => r.user_id !== data.userId);
      if (others.length === 0) throw new Error("Il doit rester au moins un super administrateur.");
    }
    await a.from("user_roles").delete().eq("user_id", data.userId);
    if (data.roles.length) {
      const { error } = await a.from("user_roles").insert(data.roles.map((role) => ({ user_id: data.userId, role })));
      if (error) throw new Error(error.message);
    }
    await a.from("audit_log").insert({ user_id: context.userId, action: `SET_ROLES:${data.roles.join(",")}`, table_name: "user_roles", record_id: data.userId });
    return { ok: true };
  });

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), full_name: z.string().trim().min(2).max(100), roles: z.array(z.enum(ROLES)).min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const a = await assertSuperAdmin(context);
    const password = genTempPassword();
    const { data: u, error } = await a.auth.admin.createUser({
      email: data.email, password, email_confirm: true, user_metadata: { full_name: data.full_name },
    });
    if (error || !u.user) throw new Error(error?.message.includes("already") ? "Cet email est déjà utilisé." : (error?.message ?? "Erreur"));
    await a.from("user_roles").insert(data.roles.map((role) => ({ user_id: u.user!.id, role })));
    await a.from("audit_log").insert({ user_id: context.userId, action: `CREATE_STAFF:${data.roles.join(",")}`, table_name: "user_roles", record_id: u.user.id });
    return { email: data.email, password };
  });
