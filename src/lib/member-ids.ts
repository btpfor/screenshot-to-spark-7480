// Members sign in with their matricule; auth needs an email, so we derive a fixed internal one.
export const MEMBER_EMAIL_DOMAIN = "membres.bokguisguis.sn";

export const matriculeToEmail = (m: string) =>
  `${m.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")}@${MEMBER_EMAIL_DOMAIN}`;

export const loginToEmail = (id: string) => (id.includes("@") ? id.trim() : matriculeToEmail(id));

export const isMatricule = (id: string) => /^(?:BGG-\d{4}-\d{4}|vipbgg-[a-z0-9]{3})$/i.test(id.trim());

export function memberIdentifierFromCni(cni: string) {
  const number = cni.trim();
  if (!/^[a-z0-9]{3,40}$/i.test(number)) {
    throw new Error("Saisissez le numéro de carte d’identité complet, avec au moins trois caractères (lettres ou chiffres).");
  }
  return `vipbgg-${number.slice(-3).toLowerCase()}`;
}

export function genTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("") + "!7";
}
