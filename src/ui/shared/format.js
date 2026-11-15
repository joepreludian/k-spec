/** 999 → "999", 184000 → "184k", 1200000 → "1.2M". */
export function formatTokens(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${Math.floor(v / 1000)}k`;
  return `${(v / 1_000_000).toFixed(1)}M`;
}

/** First 8 characters of an id followed by an ellipsis (ids of 8 or fewer stay whole). */
export function shortId(id) {
  const s = String(id ?? "");
  return s.length > 8 ? `${s.slice(0, 8)}…` : s;
}

/** Input + output. `cached` is a breakdown of input and is never summed (see design). */
export function sessionTotalTokens(session) {
  const t = session?.tokens;
  return t ? (t.input ?? 0) + (t.output ?? 0) : 0;
}
