import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const gieQuery = queryOptions({
  queryKey: ["gie-settings"],
  queryFn: async () => {
    const [s, c] = await Promise.all([
      supabase.from("gie_settings").select("*").eq("id", 1).single(),
      supabase.from("gie_contacts").select("*").order("sort_order"),
    ]);
    return { settings: s.data, contacts: c.data ?? [] };
  },
  staleTime: 60_000,
});

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
export const waHref = (phone: string, text?: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
