"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const BOARD_POLL_INTERVAL_MS = 10000;

const LOADING = Object.freeze({ status: "loading", board: null, version: null, error: null });
const UNREACHABLE = Object.freeze({ status: "error", board: null, version: null, error: { message: "Could not load the board" } });
const ready = (board, version) => ({ status: "ready", board, version, error: null });

/**
 * The server's board, kept fresh, and the one place that knows which board is the newest.
 *
 * Returns `{ status: "loading" | "ready" | "error", board, version, error, accept }`. It loads
 * `/api/board` once, then asks `/api/board/version` every few seconds while the tab is visible
 * (and when it becomes visible) and reloads when the version is not the one it holds. A failed
 * reload keeps the board already shown and is retried on the next tick.
 *
 * `accept({ board, version })` hands in the answer of a command this browser sent: a newer
 * version becomes the board (so the next poll has nothing to reload), an older one is ignored
 * and the board is checked again. It returns the board that should be on screen.
 */
export function useRemoteBoard() {
  const [state, setState] = useState(LOADING);
  const newest = useRef({ board: null, version: null });
  const accepted = useRef(0); // counts accepted command answers, to spot board answers they overtook
  const reload = useRef(() => {});

  const take = (board, version) => {
    newest.current = { board, version };
    setState(ready(board, version));
  };

  useEffect(() => {
    let alive = true;
    let loading = false;

    const load = async () => {
      if (loading) return;
      loading = true;
      const acceptedAtStart = accepted.current;
      try {
        const res = await fetch("/api/board", { cache: "no-store" });
        if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
        const { board, version } = await res.json();
        if (!alive) return;
        const overtaken = accepted.current !== acceptedAtStart && version <= newest.current.version;
        if (!overtaken) take(board, version);
      } catch {
        if (alive) setState((prev) => (prev.board ? prev : UNREACHABLE));
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
        if (alive && version !== newest.current.version) await load();
      } catch {
        // a failed check is not news; the next tick asks again
      }
    };

    reload.current = load;
    load();
    const timer = setInterval(check, BOARD_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      reload.current = () => {};
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const accept = useCallback((answer) => {
    const known = newest.current.version;
    if (answer?.board && Number.isInteger(answer.version) && (known === null || answer.version > known)) {
      accepted.current += 1;
      take(answer.board, answer.version);
    } else {
      reload.current(); // not newer than what is shown: let the server say what is current
    }
    return newest.current.board;
  }, []);

  return { ...state, accept };
}
