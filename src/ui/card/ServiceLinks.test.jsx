import { render, screen } from "@testing-library/react";
import { ServiceLinks } from "./ServiceLinks.jsx";
import { createCard, publishService, startWork } from "@/domain/card.js";

const T = "2026-11-14T10:00:00.000Z";
const API = "http://localhost:8002";
const working = () =>
  startWork(createCard({ id: "c1", number: 1, title: "Card", now: T }), { location: { kind: "lima", name: "lima-dev" }, branch: "main" }, T);

afterEach(() => {
  delete global.fetch;
});

test("renders nothing without services or without work", () => {
  global.fetch = vi.fn();
  const { container, rerender } = render(<ServiceLinks card={working()} />);
  expect(container).toBeEmptyDOMElement();
  rerender(<ServiceLinks card={createCard({ id: "c2", number: 2, title: "Idle", now: T })} />);
  expect(container).toBeEmptyDOMElement();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("lists each service as a new-tab link that names its state", async () => {
  global.fetch = vi.fn().mockResolvedValue({ type: "opaque" });
  const card = publishService(publishService(working(), { id: "s1", url: API }, T), { id: "s2", title: "Preview", url: "https://preview.test/app" }, T);
  render(<ServiceLinks card={card} />);
  expect(screen.getByRole("heading", { name: "Services" })).toBeInTheDocument();
  const api = await screen.findByRole("link", { name: "localhost:8002, online" });
  expect(api).toHaveAttribute("href", API);
  expect(api).toHaveAttribute("target", "_blank");
  expect(api).toHaveAttribute("rel", "noreferrer noopener");
  expect(api).toHaveAttribute("title", API);
  expect(api).toHaveTextContent("localhost:8002");
  expect(await screen.findByRole("link", { name: "Preview, online" })).toHaveAttribute("href", "https://preview.test/app");
});

test("a service that does not answer is still a link", async () => {
  global.fetch = vi.fn().mockRejectedValue(new TypeError("down"));
  render(<ServiceLinks card={publishService(working(), { id: "s1", url: API }, T)} />);
  expect(screen.getByRole("link", { name: "localhost:8002, checking" })).toHaveAttribute("href", API);
  expect(await screen.findByRole("link", { name: "localhost:8002, offline" })).toHaveAttribute("href", API);
});
