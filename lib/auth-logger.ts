// Drizzle errors may embed passwords/session tokens in SQL parameters. Never
// forward provider messages or error objects to the application's logs.
export const authLogger = {
  level: "warn" as const,
  log(level: "debug" | "info" | "warn" | "error", _message: string, ..._args: unknown[]) {
    void _message;
    void _args;
    if (level === "error") console.error("[Field Monitoring auth] Authentication service error.");
    else if (level === "warn") console.warn("[Field Monitoring auth] Authentication service warning.");
  },
};
