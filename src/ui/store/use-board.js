import { useContext } from "react";
import { BoardContext } from "./board-context.js";

/** @returns {{ board: object, dispatch: (name: string, input?: object) => Promise<object|undefined>, pending: boolean }} */
export function useBoard() {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard must be used inside a BoardProvider");
  return value;
}
