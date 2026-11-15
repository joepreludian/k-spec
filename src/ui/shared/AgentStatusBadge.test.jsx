import { render, screen } from "@testing-library/react";
import { AgentStatusBadge } from "./AgentStatusBadge.jsx";

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
