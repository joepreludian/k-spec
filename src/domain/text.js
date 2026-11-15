export function requireNonEmpty(value, ErrorClass) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length === 0) throw new ErrorClass();
  return trimmed;
}
