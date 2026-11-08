import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super administrateur",
  president: "Président",
  secretaire: "Secrétaire général",
  tresorier: "Trésorier",
  resp_chauffeurs: "Responsable des chauffeurs",
  resp_parc: "Responsable du parc automobile",
  resp_partenariats: "Responsable des partenariats",
  chauffeur: "Chauffeur",
};

export const ROLE_PERMISSIONS: Record<AppRole, string> = {
  super_admin: "Accès complet, y compris l'attribution des rôles.",
  president: "Supervision générale : membres, véhicules, finances, journal d'audit.",
  secretaire: "Gestion administrative : création et modification des membres.",
  tresorier: "Gestion financière : cotisations, recettes, dépenses, dettes.",
  resp_chauffeurs: "Gestion des membres : ajout, modification, comptes.",
  resp_parc: "Gestion du parc automobile et des alertes véhicules.",
  resp_partenariats: "Gestion des partenaires (module à venir) et consultation.",
  chauffeur: "Accès à son espace personnel uniquement.",
};

export const CAN = {
  manageDrivers: ["super_admin", "president", "secretaire", "resp_chauffeurs"] as AppRole[],
  deleteDrivers: ["super_admin", "president"] as AppRole[],
  manageVehicles: ["super_admin", "president", "resp_parc"] as AppRole[],
  manageFinance: ["super_admin", "president", "tresorier"] as AppRole[],
  manageUsers: ["super_admin"] as AppRole[],
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUser(data.user);
      if (data.user) {
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
        if (active) setRoles((r ?? []).map((x) => x.role));
      } else setRoles([]);
      if (active) setLoading(false);
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") load();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isStaff = roles.some((r) => r !== "chauffeur");
  const can = (allowed: AppRole[]) => roles.some((r) => allowed.includes(r));
  return { user, roles, loading, isStaff, can };
}
