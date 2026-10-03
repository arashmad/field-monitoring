// Jest runs on the server, outside Next.js's React Server Component loader.
// Only bypass the import guard; the database connection remains real.
jest.mock("server-only", () => ({}));

import { sql } from "drizzle-orm";
import { db } from "../../db/client";

afterAll(async () => {
  await db.$client.end();
});

describe("PostgreSQL connection", () => {
  it("executes a query against the configured database", async () => {
    const result = await db.execute<{
      connected: number;
      database: string;
    }>(sql`SELECT 1 AS connected, current_database() AS database`);

    expect(result.rows).toEqual([
      { connected: 1, database: process.env.POSTGRES_DB },
    ]);
  }, 10_000);

  it("has an enabled and callable PostGIS extension", async () => {
    const result = await db.execute<{ version: string }>(
      sql`SELECT PostGIS_Version() AS version`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].version).toMatch(/^\d+\.\d+/);
  }, 10_000);
});
