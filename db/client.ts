/**
 * This is for db connection
*/

import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { authRelations } from "./schemas/auth";

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

const globalForDb = globalThis as typeof globalThis & {
  postgresPool?: Pool;
};

const pool =
  globalForDb.postgresPool ??
  new Pool({
    host: requiredEnv("POSTGRES_HOST"),
    port: Number(requiredEnv("POSTGRES_PORT")),
    database: requiredEnv("POSTGRES_DB"),
    user: requiredEnv("POSTGRES_USER"),
    password: requiredEnv("POSTGRES_PASSWORD"),
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresPool = pool; // Avoid creating a new pool in 'Hot reload'
}

export const db = drizzle({ client: pool, relations: { ...authRelations } });
