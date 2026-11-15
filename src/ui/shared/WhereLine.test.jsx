import { render, screen } from "@testing-library/react";
import { WhereLine } from "./WhereLine.jsx";

test("shows kind and branch", () => {
  render(<WhereLine work={{ location: { kind: "lima", name: "lima-dev" }, branch: "feat/x" }} />);
  expect(screen.getByText("lima")).toHaveAttribute("title", "lima-dev");
  expect(screen.getByText("feat/x")).toHaveClass("font-mono");
});

test("renders nothing for null", () => {
  expect(render(<WhereLine work={null} />).container).toBeEmptyDOMElement();
});
