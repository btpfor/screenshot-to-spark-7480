export function bureauContactAllowed(phone: string | null, enabled: boolean) {
  return enabled && Boolean(phone?.trim());
}