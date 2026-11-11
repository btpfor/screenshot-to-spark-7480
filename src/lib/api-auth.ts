import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Origins allowed to call the admin API bridge cross-origin. The Cloudflare
// deployment is fixed; extra origins can be added via the ALLOWED_ORIGINS
// server env (comma-separated) without a redeploy.
const DEFAULT_ORIGINS = [
  "https://screenshot-to-spark-7480.sheikhmbaake.workers.dev",
  "https://screenshot-to-spark-7480.lovable.app",
];

function allowedOrigins(): string[] {
  const extra = (process.env["ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!allowedOrigins().includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(request: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

export function optionsResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(request: Request, e: unknown): Response {
  if (e instanceof ApiError) return json(request, { error: e.message }, e.status);
  if (e instanceof ZodError) return json(request, { error: e.issues[0]?.message ?? "Données invalides." }, 400);
  console.error("[api-public]", e);
  // Plain Errors from the member helpers are user-facing rule refusals
  // (duplicate CNI, weak password, phone already used), not server failures.
  if (e instanceof Error) return json(request, { error: e.message }, 400);
  return json(request, { error: "Erreur serveur." }, 500);
}

export type ApiAuthContext = { supabase: SupabaseClient<Database>; userId: string };

// Verifies the caller's own login token: a request from Cloudflare is never
// trusted by origin alone. Returns a user-scoped client (RLS applies).
export async function authenticateApiRequest(request: Request): Promise<ApiAuthContext> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new ApiError(500, "Configuration du serveur incomplète.");
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.split(".").length !== 3) throw new ApiError(401, "Connexion requise. Reconnectez-vous.");
  const supabase = createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) throw new ApiError(401, "Session expirée. Reconnectez-vous.");
    return { supabase, userId: data.claims.sub };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(401, "Session expirée. Reconnectez-vous.");
  }
}

type AppRole = Database["public"]["Enums"]["app_role"];

export async function requireRoles(ctx: ApiAuthContext, roles: readonly AppRole[]) {
  const { data } = await ctx.supabase.rpc("has_any_role", { _user_id: ctx.userId, _roles: [...roles] });
  if (!data) throw new ApiError(403, "Accès refusé");
}
