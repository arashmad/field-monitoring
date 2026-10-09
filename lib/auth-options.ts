import "server-only";

import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { db } from "@/db/client";
import * as schema from "@/db/schemas";
import { authLogger } from "./auth-logger";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const secret = requiredEnv("BETTER_AUTH_SECRET");
if (secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
const baseURL = requiredEnv("BETTER_AUTH_URL");
const url = new URL(baseURL);
if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
  throw new Error("BETTER_AUTH_URL must use HTTPS in production");
}

export const authOptions = {
  appName: "Field Monitoring",
  logger: authLogger,
  secret,
  baseURL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    autoSignIn: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  // Enforce the same brute-force protection locally and in production.
  rateLimit: { enabled: true },
} satisfies BetterAuthOptions;
