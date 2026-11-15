/**
 * Hosts allowed to load Next.js dev resources (the HMR websocket in particular).
 * Next blocks cross-origin dev requests unless the host is allow-listed; without the
 * websocket the Turbopack dev client never hydrates and the board is read-only. The
 * host the access link is printed with (K_SPEC_HOST) is the one browsers use, so it is
 * the one we allow. Only the host name counts: Next ignores ports here.
 */
export function allowedDevOrigins(env = process.env) {
  const raw = typeof env.K_SPEC_HOST === "string" ? env.K_SPEC_HOST.trim() : "";
  if (raw.length === 0) return [];
  const host = raw.replace(/:\d+$/, "");
  return host.length > 0 ? [host] : [];
}
