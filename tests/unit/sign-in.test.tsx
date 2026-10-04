import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { signInSchema } from "@/lib/sign-in-schema";

const signIn = jest.fn();
const replace = jest.fn();
jest.mock("@/lib/auth-client", () => ({ authClient: { signIn: { email: (...args: unknown[]) => signIn(...args) } } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: jest.fn() }) }));

beforeEach(() => jest.clearAllMocks());

test("rejects malformed email and empty password without changing password whitespace", () => {
  expect(signInSchema.safeParse({ email: "invalid", password: "" }).success).toBe(false);
  expect(signInSchema.parse({ email: " grower@example.test ", password: " spaces " })).toEqual({ email: "grower@example.test", password: " spaces " });
});

test("shows field validation errors before submitting credentials", async () => {
  render(<SignInForm />);
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText("Enter a valid email address.")).toBeVisible();
  expect(screen.getByText("Enter your password.")).toBeVisible();
  expect(signIn).not.toHaveBeenCalled();
});

function fillCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "grower@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-password" } });
}

test("shows a generic authentication error and allows retry", async () => {
  signIn.mockResolvedValue({ error: { status: 401, message: "private provider detail" }, data: null });
  render(<SignInForm />);
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  expect(replace).not.toHaveBeenCalled();
});

test("keeps submission pending until the request completes and enters the protected app", async () => {
  let resolve!: (value: { error: null }) => void;
  signIn.mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<SignInForm />);
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled());
  expect(signIn).toHaveBeenCalledWith({ email: "grower@example.test", password: "secret-password" });
  resolve({ error: null });
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
});

test("network failures are recoverable and do not expose raw errors", async () => {
  signIn.mockRejectedValue(new Error("sensitive network detail"));
  render(<SignInForm />);
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in. Please try again.");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
});
