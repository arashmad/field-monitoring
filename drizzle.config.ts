import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schemas/index.ts",
  out: "./db/migrations",
  extensionsFilters: ["postgis"],
  dbCredentials: {
    host: requiredEnv("POSTGRES_HOST"),
    port: Number(requiredEnv("POSTGRES_PORT")),
    database: requiredEnv("POSTGRES_DB"),
    user: requiredEnv("POSTGRES_USER"),
    password: requiredEnv("POSTGRES_PASSWORD"),
    ssl: false,
  },
});
