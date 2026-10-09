import * as nextEnvModule from "@next/env";

// @next/env is CommonJS; native ESM and Jest expose its exports differently.
const nextEnv = (nextEnvModule as typeof nextEnvModule & { default?: typeof nextEnvModule }).default ?? nextEnvModule;

export function loadTestEnv(directory = process.cwd()) {
  Object.assign(process.env, { NODE_ENV: "test" });
  // All runners and the E2E app use .env.test, falling back to .env. Explicit
  // POSTGRES_* environment overrides retain priority over either file.
  return nextEnv.loadEnvConfig(directory, false, undefined, true);
}
