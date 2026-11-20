import { isValidToken } from "./token.js";

export const EXEMPT_PREFIXES = Object.freeze(["/access", "/_next/", "/favicon.ico"]);

export function isExemptPath(pathname) {
  return EXEMPT_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`),
  );
}

export const COOKIE_NAME = "k-spec-token";

/**
 * The cookies that can hold this board's token, for a request sent to `host` (the Host header).
 * Browsers keep cookies per host name, not per port, so two boards under one host name would
 * overwrite each other's cookie: each board therefore uses a name carrying its port, the first
 * in the list and the one to set. The plain name is still read: it is what the CLI sends, and
 * what a browser holds from before. A host without a port has the plain name only.
 */
export function accessCookieNames(host) {
  const [, port] = /:(\d{1,5})$/.exec(typeof host === "string" ? host : "") ?? [];
  return port ? [`${COOKIE_NAME}-${port}`, COOKIE_NAME] : [COOKIE_NAME];
}

/**
 * Pure access decision for one request. `cookieTokens` are the values found under the names
 * from `accessCookieNames` (missing ones undefined); one valid value is enough.
 * @returns {{action:'pass'} | {action:'set-cookie-and-redirect', token:string} | {action:'redirect-access', error:boolean}}
 */
export function decideAccess({ pathname, queryToken, cookieTokens = [], expected }) {
  if (isExemptPath(pathname)) return { action: "pass" };
  if (isValidToken(queryToken, expected)) return { action: "set-cookie-and-redirect", token: queryToken };
  if (cookieTokens.some((candidate) => isValidToken(candidate, expected))) return { action: "pass" };
  const hadQuery = typeof queryToken === "string" && queryToken.length > 0;
  return { action: "redirect-access", error: hadQuery };
}
