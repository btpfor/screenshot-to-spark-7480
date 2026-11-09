import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { publicCloudConfig } from "./public-cloud-config";

export type PublicBureauMember = {
  id: string;
  full_name: string | null;
  role_label: string;
  phone: string | null;
  photoUrl: string | null;
  sort_order: number;
  contact_enabled: boolean;
};

export type PublicBureau = {
  groupPhotoUrl: string | null;
  members: PublicBureauMember[];
};

export const getPublicBureau = createServerFn({ method: "GET" }).handler(async (): Promise<PublicBureau> => {
  const config = publicCloudConfig(
    { key: process.env["SUPABASE_PUBLISHABLE_KEY"], url: process.env["SUPABASE_URL"] },
    { key: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"], url: import.meta.env["VITE_SUPABASE_URL"] },
  );
  if (!config) {
    console.error("[bureau-public] Missing complete public Cloud configuration.");
    throw new Error("La présentation du bureau est momentanément indisponible.");
  }
  const { key, url } = config;
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const [settings, members] = await Promise.all([
    client.from("bureau_settings").select("group_photo_path").eq("id", 1).maybeSingle(),
    client.from("bureau_members").select("id, full_name, role_label, phone, photo_path, sort_order, contact_enabled").eq("published", true).order("sort_order"),
  ]);
  if (settings.error || members.error) {
    console.error("[bureau-public] Public read failed", { code: (settings.error ?? members.error)?.code });
    throw new Error("La présentation du bureau est momentanément indisponible.");
  }
  const mediaUrl = async (path: string | null) => {
    if (!path) return null;
    if (path.startsWith("/__l5e/assets-v1/")) return path;
    const signed = await client.storage.from("president-media").createSignedUrl(path, 3600);
    if (signed.error || !signed.data) return null;
    // Browser storage links must use the browser-reachable Cloud origin.
    const browserOrigin = import.meta.env["VITE_SUPABASE_URL"] || url;
    return signed.data.signedUrl.replace(url, browserOrigin);
  };
  const groupPhotoUrl = await mediaUrl(settings.data?.group_photo_path ?? null);
  const resolved = await Promise.all((members.data ?? []).map(async (m) => ({
    id: m.id,
    full_name: m.full_name,
    role_label: m.role_label,
    phone: m.phone,
    sort_order: m.sort_order,
    contact_enabled: m.contact_enabled,
    photoUrl: await mediaUrl(m.photo_path),
  })));
  return { groupPhotoUrl, members: resolved };
});
