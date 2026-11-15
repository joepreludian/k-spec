import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardTile } from "./CardTile.jsx";
import { createCard, addChecklist, addChecklistItem, toggleChecklistItem, addComment, setAgentStatus, addLabelToCard, startWork, endWork, publishService } from "@/domain/card.js";
import { PERSON } from "@/domain/author.js";

const T = "2026-11-14T10:00:00.000Z";
const labels = [
  { id: "l1", name: "bug", color: "red" },
  { id: "l2", name: "ui", color: "teal" },
];

function cardWithEverything() {
  let c = createCard({ id: "c1", number: 3, title: "File watcher", now: T });
  c = startWork(c, { location: { kind: "lima", name: "lima-dev" }, branch: "feat/watcher" }, T);
  c = addLabelToCard(c, "l1", T);
  c = addLabelToCard(c, "missing", T);
  c = setAgentStatus(c, "working", T);
  c = addChecklist(c, { id: "k1", title: "Steps" }, T);
  c = addChecklistItem(c, "k1", { id: "i1", text: "a" }, T);
  c = addChecklistItem(c, "k1", { id: "i2", text: "b" }, T);
  c = addChecklistItem(c, "k1", { id: "i3", text: "c" }, T);
  c = toggleChecklistItem(c, "k1", "i1", T);
  c = addComment(c, { id: "m1", author: PERSON, body: "x" }, T);
  c = addComment(c, { id: "m2", author: PERSON, body: "y" }, T);
  return c;
}

test("shows title, labels, status, progress and comment count", () => {
  render(<CardTile card={cardWithEverything()} labels={labels} onOpen={vi.fn()} />);
  expect(screen.getByText("File watcher")).toBeInTheDocument();
  expect(screen.getByText("bug")).toBeInTheDocument();
  expect(screen.queryByText("ui")).not.toBeInTheDocument();
  expect(screen.getByText("working")).toBeInTheDocument();
  expect(screen.getByText("1/3")).toBeInTheDocument();
  expect(screen.getByLabelText("2 comments")).toBeInTheDocument();
});

test("hides progress and comments when none", () => {
  render(<CardTile card={createCard({ id: "c1", number: 1, title: "Bare", now: T })} labels={labels} onOpen={vi.fn()} />);
  expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/comments?$/)).not.toBeInTheDocument();
});

test("clicking the tile calls onOpen with the card id", async () => {
  const onOpen = vi.fn();
  render(<CardTile card={createCard({ id: "c1", number: 1, title: "Bare", now: T })} labels={labels} onOpen={onOpen} />);
  await userEvent.click(screen.getByRole("button", { name: /Bare/ }));
  expect(onOpen).toHaveBeenCalledWith("c1");
});

test("shows #number before the title and labels after it", () => {
  render(<CardTile card={cardWithEverything()} labels={labels} onOpen={vi.fn()} />);
  const number = screen.getByText("#3");
  const title = screen.getByText("File watcher");
  const label = screen.getByText("bug");
  expect(number.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(title.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("button", { name: /#3 File watcher/ })).toBeInTheDocument();
});

test("shows where the card is being worked and the total progress", () => {
  render(<CardTile card={cardWithEverything()} labels={labels} onOpen={vi.fn()} />);
  expect(screen.getByText("lima")).toHaveAttribute("title", "lima-dev");
  expect(screen.getByText("feat/watcher")).toBeInTheDocument();
  expect(screen.getByText("1/3")).toBeInTheDocument();
  expect(screen.getByLabelText("Steps 1/3")).toBeInTheDocument();
});

test("hides the where-line without work", () => {
  render(<CardTile card={createCard({ id: "c1", number: 1, title: "Bare", now: T })} labels={labels} onOpen={vi.fn()} />);
  expect(screen.queryByText(/^(lima|worktree|host)$/)).not.toBeInTheDocument();
});

test("the checklist count carries an icon and a spoken label, like comments", () => {
  render(<CardTile card={cardWithEverything()} labels={labels} onOpen={vi.fn()} />);
  const count = screen.getByLabelText("1 of 3 checklist items done");
  expect(count).toHaveTextContent("1/3");
  expect(count.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

describe("service indicator", () => {
  const LIMA = "http://lima-dev.local:3000";
  const API = "http://localhost:8002";
  const withServices = (...urls) =>
    urls.reduce((c, url, i) => publishService(c, { id: `s${i + 1}`, url }, T), cardWithEverything());
  const answering = (...upUrls) =>
    vi.fn((url) => (upUrls.includes(url) ? Promise.resolve({ type: "opaque" }) : Promise.reject(new TypeError("down"))));

  afterEach(() => {
    delete global.fetch;
  });

  test("a card without services shows no indicator and checks nothing", () => {
    global.fetch = vi.fn();
    render(<CardTile card={cardWithEverything()} labels={labels} onOpen={vi.fn()} />);
    expect(screen.queryByLabelText(/service/)).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("one answering service shows a green indicator", async () => {
    global.fetch = answering(LIMA);
    render(<CardTile card={withServices(LIMA)} labels={labels} onOpen={vi.fn()} />);
    expect(screen.getByLabelText("1 service, checking")).toBeInTheDocument();
    const indicator = await screen.findByLabelText("1 service, 1 online");
    expect(indicator).toHaveAttribute("data-online", "true");
    expect(indicator).not.toHaveTextContent("1");
  });

  test("two services, one up and one down, count both and stay green", async () => {
    global.fetch = answering(API);
    render(<CardTile card={withServices(LIMA, API)} labels={labels} onOpen={vi.fn()} />);
    const indicator = await screen.findByLabelText("2 services, 1 online");
    expect(indicator).toHaveTextContent("2");
    expect(indicator).toHaveAttribute("data-online", "true");
  });

  test("a service that does not answer shows a muted indicator", async () => {
    global.fetch = answering();
    render(<CardTile card={withServices(LIMA)} labels={labels} onOpen={vi.fn()} />);
    expect(await screen.findByLabelText("1 service, offline")).toHaveAttribute("data-online", "false");
  });

  test("the indicator shows even when the card has nothing else in its meta row", async () => {
    global.fetch = answering(LIMA);
    let c = createCard({ id: "c9", number: 9, title: "Bare", now: T });
    c = startWork(c, { location: { kind: "lima", name: "lima-dev" }, branch: "main" }, T);
    c = publishService(c, { id: "s1", url: LIMA }, T);
    render(<CardTile card={c} labels={labels} onOpen={vi.fn()} />);
    expect(await screen.findByLabelText("1 service, 1 online")).toBeInTheDocument();
  });

  test("services archived with ended work show no indicator", () => {
    global.fetch = vi.fn();
    render(<CardTile card={endWork(withServices(LIMA), T)} labels={labels} onOpen={vi.fn()} />);
    expect(screen.queryByLabelText(/service/)).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
