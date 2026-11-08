export const PRESIDENT_EDITORS = ["super_admin", "president", "secretaire"] as const;

export function canEditPresident(roles: readonly string[]) {
  return roles.some((role) => PRESIDENT_EDITORS.some((editor) => editor === role));
}

export function canReadPresident(published: boolean, roles: readonly string[]) {
  return published || canEditPresident(roles);
}