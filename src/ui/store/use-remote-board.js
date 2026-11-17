"use client";

import { useEffect, useState } from "react";

export const BOARD_POLL_INTERVAL_MS = 5000;

const LOADING = Object.freeze({ status: "loading", board: null, version: null, error: null });
const failed = (error) => ({ status: "error", board: null, version: null, error });
const UNREACHABLE = Object.freeze({ message: "Could not load the board", file: null });

/**
 * The board as the server reads it from the kspec root, kept fresh by polling.
 *
 * Returns `{ status: "loading" | "ready" | "error", board, version, error }`. It loads
 * `/api/board` once, then asks `/api/board/version` every few seconds while the tab is visible
 * (and when it becomes visible) and reloads when the version differs from the last one the
 * server answered with. A reload that fails keeps the board already shown: a broken file sets
 * `error` (`{ message, file }`) next to it, a network failure is retried on the next tick.
 */
export function useRemoteBoard() {
  const [state, setState] = useState(LOADING);

  useEffect(() => {
    let alive = true;
    let answered = null; // version of the last /api/board answer, good or broken
    let loading = false;

    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const res = await fetch("/api/board", { cache: "no-store" });
        if (res.status !== 200 && res.status !== 422) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!alive) return;
        answered = body.version ?? null;
        if (res.status === 200) {
          setState({ status: "ready", board: body.board, version: body.version, error: null });
        } else {
          const error = { message: body.error, file: body.file ?? null };
          setState((prev) => (prev.board ? { ...prev, error } : failed(error)));
        }
      } catch {
        if (alive) setState((prev) => (prev.board ? prev : failed(UNREACHABLE)));
      } finally {
        loading = false;
      }
    };

    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/board/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = await res.json();
        if (alive && version !== answered) await load();
      } catch {
        // a failed check is not news; the next tick asks again
      }
    };

    load();
    const timer = setInterval(check, BOARD_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  return state;
}
