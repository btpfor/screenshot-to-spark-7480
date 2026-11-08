import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const getPublicPresident = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Le message du Président est momentanément indisponible.");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await client.from("president_message")
    .select("name, role_label, body, photo_path, signature_path, published").eq("id", 1).eq("published", true).maybeSingle();
  if (error) throw new Error("Le message du Président est momentanément indisponible.");
  if (!data) return null;
  const mediaUrl = async (path: string | null) => {
    if (!path) return null;
    if (path.startsWith("/__l5e/assets-v1/")) return path;
    const signed = await client.storage.from("president-media").createSignedUrl(path, 3600);
    if (signed.error || !signed.data) return null;
    // Browser storage links must use the browser-reachable Cloud origin.
    const browserOrigin = import.meta.env.VITE_SUPABASE_URL;
    return signed.data.signedUrl.replace(url, browserOrigin);
  };
  const [photoUrl, signatureUrl] = await Promise.all([mediaUrl(data.photo_path), mediaUrl(data.signature_path)]);
  return { ...data, photoUrl, signatureUrl };
});