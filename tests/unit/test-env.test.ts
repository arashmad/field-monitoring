/** @jest-environment node */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as nextEnv from "@next/env";
import { loadTestEnv } from "../helpers/test-env";

test("test runners select .env.test consistently instead of development/production files", () => {
  const directory = mkdtempSync(join(tmpdir(), "field-monitoring-env-"));
  const previous = process.env.NODE_ENV;
  try {
    writeFileSync(join(directory, ".env.test"), "FM_ENV_PROBE=test-database\n");
    writeFileSync(join(directory, ".env.production"), "FM_ENV_PROBE=production-database\n");
    writeFileSync(join(directory, ".env.development"), "FM_ENV_PROBE=development-database\n");
    Object.assign(process.env, { NODE_ENV: "development" });
    const loaded = loadTestEnv(directory);
    expect(loaded.loadedEnvFiles.map(({ path }) => path)).toEqual([".env.test"]);
    expect(loaded.parsedEnv?.FM_ENV_PROBE).toBe("test-database");
  } finally {
    nextEnv.resetEnv();
    Object.assign(process.env, { NODE_ENV: previous });
    rmSync(directory, { recursive: true, force: true });
  }
});
