import { authLogger } from "@/lib/auth-logger";

test("auth logging drops provider messages and error arguments containing credentials", () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const queryError = Object.assign(new Error("Query params: SESSION_SECRET_MARKER"), { params: ["PASSWORD_SECRET_MARKER"] });
    authLogger.log("error", "Database failure SESSION_SECRET_MARKER", queryError);
    authLogger.log("warn", "Invalid credential PASSWORD_SECRET_MARKER", queryError);
    expect(error.mock.calls).toEqual([["[Field Monitoring auth] Authentication service error."]]);
    expect(warn.mock.calls).toEqual([["[Field Monitoring auth] Authentication service warning."]]);
  } finally {
    error.mockRestore();
    warn.mockRestore();
  }
});
