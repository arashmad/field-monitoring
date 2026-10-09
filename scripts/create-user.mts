import nextEnv from "@next/env";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
  if (!values.email || !values.name) throw new Error("Usage: pnpm auth:create-user --email <email> --name <name>");
  // Read the password without echo or a command-line argument/process listing.
  const hiddenOutput = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const reader = createInterface({ input: process.stdin, output: hiddenOutput, terminal: !!process.stdin.isTTY });
  let password: string;
  try {
    if (process.stdin.isTTY) {
      process.stdout.write("Password (8–128 characters, hidden): ");
      password = await reader.question("");
      process.stdout.write("\n");
    } else {
      const line = await reader[Symbol.asyncIterator]().next();
      password = line.value ?? "";
    }
  } finally {
    reader.close();
  }
  const { provisionUser } = await import("../lib/provision-user");
  const { db } = await import("../db/client");
  try {
    const user = await provisionUser({ email: values.email, name: values.name, password });
    process.stdout.write(`Account provisioned: ${user.email}\n`);
  } finally {
    await db.$client.end();
  }
}

main().catch(() => {
  console.error("Account provisioning failed. Supply --email and --name, a valid password, and configured authentication/database variables. Existing accounts are not overwritten.");
  process.exitCode = 1;
});
