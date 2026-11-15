import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessForm } from "./AccessForm.jsx";

test("submits to /?token=", async () => {
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
  render(<AccessForm error={false} />);
  await userEvent.type(screen.getByLabelText("Access token"), "abc d");
  await userEvent.click(screen.getByRole("button", { name: "Open board" }));
  expect(assign).toHaveBeenCalledWith("/?token=abc%20d");
  vi.unstubAllGlobals();
});

test("does not submit when blank", async () => {
  const assign = vi.fn();
  vi.stubGlobal("location", { ...window.location, assign });
  render(<AccessForm error={false} />);
  await userEvent.click(screen.getByRole("button", { name: "Open board" }));
  expect(assign).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test("shows error message when error is set", () => {
  render(<AccessForm error />);
  expect(screen.getByRole("alert")).toHaveTextContent(/didn.t work/i);
});

test("no error message by default", () => {
  render(<AccessForm error={false} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
