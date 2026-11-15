import { randomBytes, timingSafeEqual } from "node:crypto";

/** 32 url-safe characters. */
export function generateToken() {
  return randomBytes(24).toString("base64url");
}

/** Constant-time comparison; false for missing, empty, or length-mismatched values. */
export function isValidToken(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string") return false;
  if (candidate.length === 0 || expected.length === 0) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Returns env.K_SPEC_TOKEN, generating and storing one when missing or blank. */
export function resolveToken(env = process.env) {
  const current = typeof env.K_SPEC_TOKEN === "string" ? env.K_SPEC_TOKEN.trim() : "";
  if (current.length > 0) return current;
  const token = generateToken();
  env.K_SPEC_TOKEN = token;
  return token;
}
