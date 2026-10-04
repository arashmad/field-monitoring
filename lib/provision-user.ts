import "server-only";

import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { user } from "@/db/schemas";
import { authOptions } from "./auth-options";

const accountSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(128),
});

// Trusted CLI only. This instance is never mounted as an HTTP handler.
export async function provisionUser(input: z.input<typeof accountSchema>) {
  const account = accountSchema.parse(input);
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, account.email)).limit(1);
  if (existing.length) throw new Error("An account with this email already exists");
  const provisioner = betterAuth({
    ...authOptions,
    emailAndPassword: { ...authOptions.emailAndPassword, disableSignUp: false },
  });
  const result = await provisioner.api.signUpEmail({ body: account });
  return { id: result.user.id, name: result.user.name, email: result.user.email };
}
