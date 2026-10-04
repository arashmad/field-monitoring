// Run with pnpm test:auth (Node's ESM test runner, real PostgreSQL).
import { loadTestEnv } from "../helpers/test-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";

loadTestEnv();
process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { auth } = await import("../../lib/auth");
const { provisionUser } = await import("../../lib/provision-user");
const { db } = await import("../../db/client");
const { user, session } = await import("../../db/schemas/auth");
const { getCurrentUser, requireCurrentUser, UnauthenticatedError } = await import("../../lib/session");
const email = `auth-test-${randomUUID()}@example.test`;
const password = "Test-password-42!";
let userId: string;

async function signIn() {
  const response = await auth.api.signInEmail({
    body: { email, password }, asResponse: true,
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const data = await response.json();
  assert.ok(cookie.includes("session_token="));
  return { headers: new Headers({ cookie }), token: data.token as string };
}

before(async () => {
  const account = await provisionUser({ name: "Auth Test", email, password });
  userId = account.id;
});
after(async () => {
  if (userId) await db.delete(user).where(eq(user.id, userId));
  await db.$client.end();
});

test("anonymous and forged tokens cannot resolve an owner", async () => {
  assert.equal(await getCurrentUser(new Headers()), null);
  assert.equal(await getCurrentUser(new Headers({ cookie: "better-auth.session_token=forged" })), null);
  await assert.rejects(requireCurrentUser(new Headers()), UnauthenticatedError);
});

test("public HTTP registration remains disabled", async () => {
  const response = await auth.handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
    method: "POST", headers: { "content-type": "application/json", origin: process.env.BETTER_AUTH_URL! },
    body: JSON.stringify({ name: "Anonymous", email: "blocked@example.test", password }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "EMAIL_PASSWORD_SIGN_UP_DISABLED");
});

test("wrong credentials do not create a session", async () => {
  const response = await auth.api.signInEmail({ body: { email, password: "wrong-password" }, asResponse: true });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("sign-in resolves only the safe current-user identity", async () => {
  const { headers } = await signIn();
  assert.deepEqual(await requireCurrentUser(headers), { id: userId, name: "Auth Test", email });
});

test("expired sessions cannot resolve identity or refresh", async () => {
  const { headers, token } = await signIn();
  await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.token, token));
  assert.equal(await getCurrentUser(headers), null);
  assert.equal(await auth.api.getSession({ headers }), null);
});

test("daily renewal extends database expiry and refreshes the cookie", async () => {
  const { headers, token } = await signIn();
  const oldExpiry = new Date(Date.now() + 5 * 86400_000);
  await db.update(session).set({ expiresAt: oldExpiry }).where(eq(session.token, token));
  // RSC identity reads must not consume the renewal before a cookie can be set.
  await requireCurrentUser(headers);
  const [beforeRenewal] = await db.select().from(session).where(eq(session.token, token));
  assert.equal(beforeRenewal.expiresAt.getTime(), oldExpiry.getTime());
  const response = await auth.api.getSession({ headers, asResponse: true });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /session_token=.*Max-Age=604800/i);
  const [renewed] = await db.select().from(session).where(eq(session.token, token));
  assert.ok(renewed.expiresAt.getTime() > Date.now() + 6.9 * 86400_000);
});

test("sign-out revokes that session while another device stays signed in", async () => {
  const first = await signIn();
  const second = await signIn();
  assert.notEqual(first.token, second.token);
  const response = await auth.api.signOut({ headers: first.headers, asResponse: true });
  assert.equal(response.status, 200);
  assert.equal(await getCurrentUser(first.headers), null);
  assert.equal((await requireCurrentUser(second.headers)).id, userId);
});
