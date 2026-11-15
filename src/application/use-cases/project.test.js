import { setProject } from "./set-project.js";
import { makeDeps } from "@/test/support.js";
import { createBoard } from "@/domain/board.js";

test("setProject fills missing link ids and persists", async () => {
  const deps = makeDeps(createBoard({ id: "b", name: "Board" }));
  const { board } = await setProject(deps, {
    name: "p",
    links: [{ title: "Repo", url: "https://h" }, { id: "keep", title: "CI", url: "https://ci" }],
    readmePath: null,
  });
  expect(board.project.links).toEqual([
    { id: "id-1", title: "Repo", url: "https://h" },
    { id: "keep", title: "CI", url: "https://ci" },
  ]);
  expect((await deps.repository.load()).project.name).toBe("p");
});
