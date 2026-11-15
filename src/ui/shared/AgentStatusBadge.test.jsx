import { render, screen } from "@testing-library/react";
import { AgentStatusBadge, StatusDot } from "./AgentStatusBadge.jsx";

test("idle renders nothing", () => {
  const { container } = render(<AgentStatusBadge status="idle" />);
  expect(container).toBeEmptyDOMElement();
});

test.each([
  ["working", "working"],
  ["waiting-for-input", "waiting for input"],
  ["blocked", "blocked"],
])("%s shows text and data-status", (status, text) => {
  render(<AgentStatusBadge status={status} />);
  const badge = screen.getByText(text);
  expect(badge.closest("[data-status]")).toHaveAttribute("data-status", status);
});

test.each([
  ["working", "animate-pulse"],
  ["waiting-for-input", "animate-blink"],
  ["blocked", "animate-ring"],
])("%s dot animates with %s and respects reduced motion", (status, cls) => {
  render(<AgentStatusBadge status={status} />);
  const dot = document.querySelector("[data-status] [aria-hidden]");
  expect(dot).toHaveClass(cls, "motion-reduce:animate-none");
});

test("StatusDot renders a single aria-hidden span with the status class", () => {
  const { container } = render(<StatusDot status="blocked" />);
  expect(container.childElementCount).toBe(1);
  expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  expect(container.firstChild).toHaveClass("bg-red-500", "animate-ring", "rounded-full");
});

test("idle StatusDot is static", () => {
  const { container } = render(<StatusDot status="idle" />);
  expect(container.firstChild.className).not.toMatch(/animate-/);
});
