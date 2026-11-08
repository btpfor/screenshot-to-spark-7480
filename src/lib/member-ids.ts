// Members sign in with their matricule; auth needs an email, so we derive a fixed internal one.
export const MEMBER_EMAIL_DOMAIN = "membres.bokguisguis.sn";

export const matriculeToEmail = (m: string) =>
  `${m.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")}@${MEMBER_EMAIL_DOMAIN}`;

export const loginToEmail = (id: string) => (id.includes("@") ? id.trim() : matriculeToEmail(id));

export const isMatricule = (id: string) => /^BGG-\d{4}-\d{4}$/i.test(id.trim());

export function genTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("") + "!7";
}
