"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DomainError } from "@/domain/errors.js";
import { BoardContext } from "./board-context.js";

/**
 * Holds the Board and exposes `dispatch(commandName, input)`.
 * Commands are plain names + serialisable inputs run by the injected executor
 * (`{ execute(name, input) }`), so swapping the transport never touches the UI.
 * A command that fails shows a toast and resolves `undefined`; the board stays as it was.
 * Passing a different `initialBoard` object later replaces the held board.
 */
export function BoardProvider({ executor, initialBoard, children }) {
  const [board, setBoard] = useState(initialBoard);
  // A new `initialBoard` (the board was reloaded) replaces whatever is being shown.
  const [source, setSource] = useState(initialBoard);
  if (source !== initialBoard) {
    setSource(initialBoard);
    setBoard(initialBoard);
  }
  const [inFlight, setInFlight] = useState(0);

  const dispatch = useCallback(
    async (name, input = {}) => {
      setInFlight((n) => n + 1);
      try {
        const result = await executor.execute(name, input);
        if (result?.board) setBoard(result.board);
        return result;
      } catch (error) {
        // A broken rule explains itself; anything else means the change did not reach the store.
        if (error instanceof DomainError) {
          toast.error(error.message);
        } else {
          console.error(`Command ${name} failed`, error);
          toast.error("Could not save the change");
        }
        return undefined;
      } finally {
        setInFlight((n) => n - 1);
      }
    },
    [executor],
  );

  const value = useMemo(
    () => ({ board, dispatch, pending: inFlight > 0 }),
    [board, dispatch, inFlight],
  );

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
