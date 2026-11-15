import { render, screen } from "@testing-library/react";
import { MarkdownView } from "./MarkdownView.jsx";

test("rewrites relative markdown links, opens external in new tab, renders plain for escaping paths", () => {
  render(
    <MarkdownView basePath="docs/specs/design.md">
      {"[plan](./plan.md) [site](https://e.com) [bad](../../../x.md) [top](#top)"}
    </MarkdownView>,
  );
  expect(screen.getByRole("link", { name: "plan" })).toHaveAttribute("href", "/files/docs/specs/plan.md");
  expect(screen.getByRole("link", { name: "plan" })).not.toHaveAttribute("target");
  expect(screen.getByRole("link", { name: "site" })).toHaveAttribute("target", "_blank");
  expect(screen.getByRole("link", { name: "site" })).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  expect(screen.queryByRole("link", { name: "bad" })).not.toBeInTheDocument();
  expect(screen.getByText("bad")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "top" })).toHaveAttribute("href", "#top");
});

test("without basePath relative links are left alone", () => {
  render(<MarkdownView>{"[plan](./plan.md)"}</MarkdownView>);
  expect(screen.getByRole("link", { name: "plan" })).toHaveAttribute("href", "./plan.md");
});

test("newTab opens internal links in a new tab as well", () => {
  render(
    <MarkdownView basePath="docs/a.md" newTab>
      {"[plan](plan.md) [top](#top)"}
    </MarkdownView>,
  );
  const plan = screen.getByRole("link", { name: "plan" });
  expect(plan).toHaveAttribute("href", "/files/docs/plan.md");
  expect(plan).toHaveAttribute("target", "_blank");
  expect(plan).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  expect(screen.getByRole("link", { name: "top" })).not.toHaveAttribute("target");
});
