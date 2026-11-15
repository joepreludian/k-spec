"use client";

import { useCallback, useSyncExternalStore } from "react";

export const SERVICE_CHECK_TIMEOUT_MS = 4000;
export const SERVICE_CHECK_INTERVAL_MS = 30000;

/**
 * One live check per url, shared by everything on the page that shows it (board tile, drag
 * overlay, open dialog): url -> { status, listeners, controller, timeout, interval }.
 * A check runs while someone is subscribed and stops when the last subscriber leaves.
 */
const checks = new Map();

function runCheck(url, entry) {
  entry.controller?.abort();
  clearTimeout(entry.timeout);
  const current = new AbortController();
  entry.controller = current;
  entry.timeout = setTimeout(() => current.abort(), SERVICE_CHECK_TIMEOUT_MS);
  // A `no-cors` request is enough: any response (even an opaque one) means something is
  // listening; a network error or no answer within the timeout means offline.
  fetch(url, { mode: "no-cors", cache: "no-store", signal: current.signal })
    .then(
      () => "online",
      () => "offline",
    )
    .then((status) => {
      if (checks.get(url) !== entry || entry.controller !== current) return;
      clearTimeout(entry.timeout);
      if (entry.status === status) return;
      entry.status = status;
      for (const listener of entry.listeners) listener();
    });
}

function subscribe(url, listener) {
  let entry = checks.get(url);
  if (!entry) {
    entry = { status: "checking", listeners: new Set(), controller: null, timeout: null, interval: null };
    checks.set(url, entry);
    runCheck(url, entry);
    entry.interval = setInterval(() => runCheck(url, entry), SERVICE_CHECK_INTERVAL_MS);
  }
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size > 0) return;
    clearInterval(entry.interval);
    clearTimeout(entry.timeout);
    entry.controller?.abort();
    if (checks.get(url) === entry) checks.delete(url);
  };
}

const statusOf = (url) => checks.get(url)?.status ?? "checking";
const SEPARATOR = "\n";

/**
 * Asks, from the browser, whether each published service answers. Returns one of
 * `"checking" | "online" | "offline"` per url, in order; re-checked on an interval, and the
 * last known status holds while a re-check is in flight. A hint only: the browser can refuse
 * the request for reasons unrelated to the service being up.
 */
export function useServiceStatuses(urls) {
  const key = urls.join(SEPARATOR);
  const subscribeAll = useCallback(
    (listener) => {
      const stops = key ? key.split(SEPARATOR).map((url) => subscribe(url, listener)) : [];
      return () => stops.forEach((stop) => stop());
    },
    [key],
  );
  const snapshot = useSyncExternalStore(
    subscribeAll,
    () => (key ? key.split(SEPARATOR).map(statusOf).join(SEPARATOR) : ""),
    () => (key ? key.split(SEPARATOR).map(() => "checking").join(SEPARATOR) : ""),
  );
  return snapshot ? snapshot.split(SEPARATOR) : [];
}

/** The status of one service; `"offline"` without a url. */
export function useServiceStatus(url) {
  const [status] = useServiceStatuses(url ? [url] : []);
  return status ?? "offline";
}
