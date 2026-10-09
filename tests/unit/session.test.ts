jest.mock("server-only", () => ({}));
const getSession = jest.fn();
jest.mock("@/lib/auth", () => ({ auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } } }));
jest.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { getCurrentUser, requireCurrentUser, UnauthenticatedError } from "@/lib/session";

beforeEach(() => jest.clearAllMocks());

test("rejects a missing session instead of returning an anonymous owner", async () => {
  getSession.mockResolvedValue(null);
  expect(await getCurrentUser()).toBeNull();
  await expect(requireCurrentUser()).rejects.toBeInstanceOf(UnauthenticatedError);
});

test("exposes only the server-resolved owner identity", async () => {
  getSession.mockResolvedValue({ user: { id: "owner-1", name: "Grower", email: "grower@example.test", emailVerified: false, image: null, createdAt: new Date(), updatedAt: new Date() }, session: { token: "private-token" } });
  expect(await requireCurrentUser()).toEqual({ id: "owner-1", name: "Grower", email: "grower@example.test" });
});

test("database failures propagate and never grant access or pretend credentials are wrong", async () => {
  getSession.mockRejectedValue(new Error("database unavailable"));
  await expect(requireCurrentUser()).rejects.toThrow("database unavailable");
});
