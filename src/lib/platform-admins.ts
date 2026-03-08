export const PLATFORM_ADMIN_EMAILS = [
  "admin@crapro95.com",
  "ricardo.ortellado@outlook.com",
] as const;

export function isPlatformAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase() as (typeof PLATFORM_ADMIN_EMAILS)[number]);
}
