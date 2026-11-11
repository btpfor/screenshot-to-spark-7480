import { supabase } from "@/integrations/supabase/client";

// On the external (Cloudflare) deployment, VITE_API_URL points to the
// Lovable-hosted backend that holds the admin keys. When unset (Lovable
// hosting), the app uses its same-origin server functions instead.
export function externalApiUrl(): string | null {
  const url = import.meta.env["VITE_API_URL"] as string | undefined;
  return url && url.trim() ? url.trim().replace(/\/+$/, "") : null;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const base = externalApiUrl();
  if (!base) throw new Error("API externe non configurée.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Connexion requise. Reconnectez-vous.");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.");
  }
  const payload = (await res.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!res.ok) throw new Error(payload?.error ?? "Le serveur a refusé la demande. Réessayez.");
  return payload as T;
}
