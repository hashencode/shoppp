export function isAdminIdentityExpired(expiresAt: string | null, now = new Date()): boolean {
  if (expiresAt === null) return false;
  const expiry = Date.parse(expiresAt);
  return (
    !Number.isFinite(expiry) ||
    new Date(expiry).toISOString() !== expiresAt ||
    expiry <= now.getTime()
  );
}
