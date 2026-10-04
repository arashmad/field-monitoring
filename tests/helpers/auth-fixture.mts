// Test-only database fixtures, executed in a separate server-only process.
import { loadTestEnv } from "./test-env";
import { eq } from "drizzle-orm";

loadTestEnv();
let input = "";
for await (const chunk of process.stdin) input += chunk;
const command = JSON.parse(input) as { action: "create" | "expire" | "age" | "delete"; email: string; password?: string };
if (!/^e2e-[a-f0-9-]+@example\.test$/.test(command.email)) throw new Error("Only isolated E2E accounts may be changed");
const { db } = await import("../../db/client");
const { user, session } = await import("../../db/schemas/auth");
try {
  if (command.action === "create") {
    const { provisionUser } = await import("../../lib/provision-user");
    const created = await provisionUser({ email: command.email, name: "Test Grower", password: command.password! });
    process.stdout.write(JSON.stringify(created));
  } else {
    const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, command.email));
    if (!owner) throw new Error("Test account not found");
    if (command.action === "delete") await db.delete(user).where(eq(user.id, owner.id));
    else await db.update(session).set({ expiresAt: new Date(Date.now() + (command.action === "expire" ? -1000 : 5 * 86400_000)) }).where(eq(session.userId, owner.id));
  }
} finally {
  await db.$client.end();
}
