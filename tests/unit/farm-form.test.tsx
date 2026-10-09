import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FarmForm } from "@/components/farms/farm-form";

test("create form has an accessible required Farm name", () => {
  render(<FarmForm mode="create" action={async () => ({ nameError: "", formError: "" })} />);
  const name = screen.getByRole("textbox", { name: "Farm name" });
  expect(name).toBeRequired();
  expect(name).toHaveAttribute("maxLength", "100");
  expect(screen.getByRole("button", { name: "Create farm" })).toBeVisible();
});

test("shows a safe server validation error and allows retry", async () => {
  const action = jest.fn()
    .mockResolvedValueOnce({ nameError: "Enter a farm name.", formError: "" })
    .mockResolvedValueOnce({ nameError: "", formError: "Unable to save farm. Please try again." });
  render(<FarmForm mode="create" action={action} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Farm name" }), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Create farm" }));
  expect(await screen.findByText("Enter a farm name.")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Farm name" })).toHaveValue(" ");
  fireEvent.change(screen.getByRole("textbox", { name: "Farm name" }), { target: { value: "North" } });
  fireEvent.click(screen.getByRole("button", { name: "Create farm" }));
  expect(await screen.findByText("Unable to save farm. Please try again.")).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "Create farm" })).toBeEnabled());
});

test("edit form starts with the Farm name", () => {
  render(<FarmForm mode="edit" initialName="North" action={async () => ({ nameError: "", formError: "" })} />);
  expect(screen.getByRole("textbox", { name: "Farm name" })).toHaveValue("North");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
});
