"use client";

import { useEffect, useState } from "react";
import { apiFileUrl } from "./file-urls.js";

const ERROR_TEXT = { 403: "Not allowed", 404: "Not found", 413: "Too large" };
const errorFor = (status) => ERROR_TEXT[status] ?? "Could not load";
const IDLE = Object.freeze({ status: "idle", content: "", error: null });
const LOADING = Object.freeze({ status: "loading", content: "", error: null });

/**
 * Fetches a project markdown file through `/api/files/<path>`.
 * Returns `{ status: "idle" | "loading" | "ok" | "error", content, error }`.
 * The result is keyed by path, so a response for a previous path is never shown.
 */
export function useMarkdownFile(path) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    fetch(apiFileUrl(path), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return { status: "error", content: "", error: errorFor(res.status) };
        const body = await res.json();
        return { status: "ok", content: body.content ?? "", error: null };
      })
      .catch(() => ({ status: "error", content: "", error: "Could not load" }))
      .then((next) => {
        if (alive) setResult({ path, ...next });
      });
    return () => {
      alive = false;
    };
  }, [path]);

  if (!path) return IDLE;
  if (!result || result.path !== path) return LOADING;
  return result;
}
