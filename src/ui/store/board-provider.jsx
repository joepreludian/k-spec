"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DomainError } from "@/domain/errors.js";
import { BoardContext } from "./board-context.js";

/**
 * Holds the Board and exposes `dispatch(commandName, input)`.
 * Commands are plain names + serialisable inputs run by the injected executor
 * (`{ execute(name, input) }`), so swapping the transport never touches the UI.
 */
export function BoardProvider({ executor, initialBoard, children }) {
  const [board, setBoard] = useState(initialBoard);
  const [inFlight, setInFlight] = useState(0);

  const dispatch = useCallback(
    async (name, input = {}) => {
      setInFlight((n) => n + 1);
      try {
        const result = await executor.execute(name, input);
        if (result?.board) setBoard(result.board);
        return result;
      } catch (error) {
        if (error instanceof DomainError) {
          toast.error(error.message);
          return undefined;
        }
        throw error;
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
