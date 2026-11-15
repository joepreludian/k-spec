import { InvalidLinkUrl } from "./errors.js";

function parseHttpUrl(url) {
  if (typeof url !== "string") throw new InvalidLinkUrl(url);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new InvalidLinkUrl(url);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new InvalidLinkUrl(url);
  return parsed;
}

/** Only absolute http(s) URLs may become links; returns the URL exactly as given. */
export function assertHttpUrl(url) {
  parseHttpUrl(url);
  return url;
}

/** Something a person can open: `{ id, title, url }`. A blank title becomes the URL's host (with port). */
export function createService({ id, title, url }) {
  const { host } = parseHttpUrl(url);
  return { id, title: typeof title === "string" && title.trim() ? title.trim() : host, url };
}
