import { isValidToken } from "./token.js";

export const EXEMPT_PREFIXES = Object.freeze(["/access", "/_next/", "/favicon.ico"]);

export function isExemptPath(pathname) {
  return EXEMPT_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`),
  );
}

/**
 * Pure access decision for one request.
 * @returns {{action:'pass'} | {action:'set-cookie-and-redirect', token:string} | {action:'redirect-access', error:boolean}}
 */
export function decideAccess({ pathname, queryToken, cookieToken, expected }) {
  if (isExemptPath(pathname)) return { action: "pass" };
  if (isValidToken(queryToken, expected)) return { action: "set-cookie-and-redirect", token: queryToken };
  if (isValidToken(cookieToken, expected)) return { action: "pass" };
  const hadQuery = typeof queryToken === "string" && queryToken.length > 0;
  return { action: "redirect-access", error: hadQuery };
}
