export type MemberConflict = "cni" | "identifier";
type Lookup = (field: "cni_number" | "matricule", value: string) => Promise<boolean>;

export const normalizeCni = (cni: string) => cni.trim().toLowerCase();

export async function findMemberConflict(cni: string, identifier: string, exists: Lookup): Promise<MemberConflict | null> {
  if (await exists("cni_number", normalizeCni(cni))) return "cni";
  if (await exists("matricule", identifier)) return "identifier";
  return null;
}

export function memberConflictMessage(conflict: MemberConflict, identifier: string) {
  return conflict === "cni"
    ? "Ce numéro de carte d’identité (CNI) est déjà enregistré pour un membre. Aucun nouveau compte n’a été créé."
    : `L’identifiant « ${identifier} » existe déjà : une autre CNI se termine par les mêmes trois caractères. Aucun compte n’a été créé. Vérifiez le numéro de CNI ou contactez le super administrateur.`;
}

export function conflictFromDatabaseError(error: { code?: string; message: string }): MemberConflict | null {
  if (error.code !== "23505") return null;
  if (error.message.includes("drivers_cni_unique")) return "cni";
  if (error.message.includes("matricule")) return "identifier";
  return null;
}