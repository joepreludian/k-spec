import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineEdit } from "./InlineEdit.jsx";

test("keyboard: Enter on the focused text starts editing", async () => {
  render(<InlineEdit as="h2" value="Spec" inputLabel="Card title" onSubmit={vi.fn()} />);
  expect(screen.getByRole("heading", { level: 2, name: "Spec" })).toBeInTheDocument();
  screen.getByRole("button", { name: "Spec" }).focus();
  await userEvent.keyboard("{Enter}");
  expect(screen.getByLabelText("Card title")).toHaveValue("Spec");
});

test("mouse: clicking starts editing; Enter submits the trimmed changed value", async () => {
  const onSubmit = vi.fn();
  render(<InlineEdit value="Spec" inputLabel="Card title" onSubmit={onSubmit} />);
  await userEvent.click(screen.getByText("Spec"));
  const input = screen.getByLabelText("Card title");
  await userEvent.clear(input);
  await userEvent.type(input, "  New  {Enter}");
  expect(onSubmit).toHaveBeenCalledWith("New");
  expect(screen.queryByLabelText("Card title")).not.toBeInTheDocument();
});

test("unchanged or blank value does not submit", async () => {
  const onSubmit = vi.fn();
  render(<InlineEdit value="Spec" inputLabel="Card title" onSubmit={onSubmit} />);
  await userEvent.click(screen.getByText("Spec"));
  await userEvent.type(screen.getByLabelText("Card title"), "{Enter}");
  await userEvent.click(screen.getByText("Spec"));
  await userEvent.clear(screen.getByLabelText("Card title"));
  await userEvent.type(screen.getByLabelText("Card title"), "   {Enter}");
  expect(onSubmit).not.toHaveBeenCalled();
});
