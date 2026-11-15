"use client";

import { useEffect, useState } from "react";

export const SERVICE_CHECK_TIMEOUT_MS = 4000;
export const SERVICE_CHECK_INTERVAL_MS = 30000;

/**
 * Asks, from the browser, whether a published service answers: `"checking" | "online" | "offline"`.
 * A `no-cors` request is enough: any response (even an opaque one) means something is listening,
 * a network error or no answer within the timeout means offline. Re-checked on an interval.
 * The result is keyed by url, so an answer for a previous url is never shown. A hint only:
 * the browser can refuse the request for reasons unrelated to the service being up.
 */
export function useServiceStatus(url) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!url) return undefined;
    let alive = true;
    let controller = null;
    let timeout = null;

    const check = () => {
      controller?.abort();
      clearTimeout(timeout);
      const current = new AbortController();
      controller = current;
      timeout = setTimeout(() => current.abort(), SERVICE_CHECK_TIMEOUT_MS);
      fetch(url, { mode: "no-cors", cache: "no-store", signal: current.signal })
        .then(
          () => "online",
          () => "offline",
        )
        .then((status) => {
          if (!alive || controller !== current) return;
          clearTimeout(timeout);
          setResult({ url, status });
        });
    };

    check();
    const interval = setInterval(check, SERVICE_CHECK_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
      clearTimeout(timeout);
      controller?.abort();
    };
  }, [url]);

  if (!url) return "offline";
  if (!result || result.url !== url) return "checking";
  return result.status;
}
