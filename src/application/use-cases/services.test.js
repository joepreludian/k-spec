import { publishService } from "./publish-service.js";
import { unpublishService } from "./unpublish-service.js";
import { startWork } from "./start-work.js";
import { makeDeps, T0 } from "@/test/support.js";
import { createBoard, addLane, addCardToLane, findCard } from "@/domain/board.js";
import { createCard } from "@/domain/card.js";
import { NoActiveWork, ServiceNotFound } from "@/domain/errors.js";

const initial = addCardToLane(
  addLane(createBoard({ id: "b", name: "Board" }), { id: "a", name: "A" }),
  "a",
  createCard({ id: "c1", number: 1, title: "Card", now: "2026-11-01T00:00:00.000Z" }),
);
let deps;
beforeEach(async () => {
  deps = makeDeps(initial);
});
const services = (board) => findCard(board, "c1").card.work.services;

test("publishService stores the service with a generated id and a default title, and persists", async () => {
  await startWork(deps, { cardId: "c1", location: { kind: "host", name: "mbp" }, branch: "main" });
  const { board, id } = await publishService(deps, { cardId: "c1", url: "http://localhost:8002" });
  expect(services(board)).toEqual([{ id, title: "localhost:8002", url: "http://localhost:8002" }]);
  expect(typeof id).toBe("string");
  expect(findCard(board, "c1").card.updatedAt).toBe(T0);
  expect(services(await deps.repository.load())).toHaveLength(1);
});

test("publishService keeps a given title", async () => {
  await startWork(deps, { cardId: "c1", location: { kind: "host", name: "mbp" }, branch: "main" });
  const { board } = await publishService(deps, { cardId: "c1", url: "http://localhost:8002", title: "API" });
  expect(services(board)[0].title).toBe("API");
});

test("publishService without active work rejects with NoActiveWork", async () => {
  await expect(publishService(deps, { cardId: "c1", url: "http://localhost:8002" })).rejects.toThrow(NoActiveWork);
});

test("unpublishService removes the service", async () => {
  await startWork(deps, { cardId: "c1", location: { kind: "host", name: "mbp" }, branch: "main" });
  const { id } = await publishService(deps, { cardId: "c1", url: "http://localhost:8002" });
  const { board } = await unpublishService(deps, { cardId: "c1", serviceId: id });
  expect(services(board)).toEqual([]);
  await expect(unpublishService(deps, { cardId: "c1", serviceId: id })).rejects.toThrow(ServiceNotFound);
});
