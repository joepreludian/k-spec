import { createLocalCommandExecutor } from "./local-command-executor.js";
import { makeDeps } from "@/test/support.js";
import { createBoard } from "@/domain/board.js";

const b = createBoard({ id: "b", name: "Board" });

test("executes a command and returns its result", async () => {
  const ex = createLocalCommandExecutor(makeDeps(b));
  const { board, id } = await ex.execute("createLane", { name: "QA" });
  expect(id).toBe("id-1");
  expect(board.lanes[0].name).toBe("QA");
  expect((await ex.execute("getBoard")).board.lanes).toHaveLength(1);
});

test("unknown command throws", async () => {
  const ex = createLocalCommandExecutor(makeDeps(b));
  await expect(ex.execute("nope", {})).rejects.toThrow("Unknown command: nope");
});
