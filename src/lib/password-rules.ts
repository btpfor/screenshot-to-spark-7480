export function passwordChangeError(current: string, next: string, confirmation: string) {
  if (next !== confirmation) return "Les mots de passe ne correspondent pas.";
  if (next.length < 6) return "6 caractères minimum (par exemple 6 chiffres).";
  if (next === current) return "Choisissez un mot de passe différent du mot de passe actuel.";
  return null;
}