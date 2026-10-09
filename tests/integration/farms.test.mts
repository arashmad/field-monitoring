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
const { farm } = await import("../../db/schemas/farm");
const { user, session } = await import("../../db/schemas/auth");
const { UnauthenticatedError } = await import("../../lib/session");
const { createFarm, listFarms, getFarm, updateFarm, FarmValidationError } = await import("../../features/farms/service");

const password = "Test-password-42!";
const emails = [0, 1].map(() => `farms-test-${randomUUID()}@example.test`);
const userIds: string[] = [];
const headersByUser: Headers[] = [];

before(async () => {
  for (const email of emails) {
    const account = await provisionUser({ name: "Farm Test", email, password });
    userIds.push(account.id);
    const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    assert.equal(response.status, 200);
    headersByUser.push(new Headers({ cookie: response.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") }));
  }
});

after(async () => {
  for (const id of userIds) await db.delete(user).where(eq(user.id, id));
  await db.$client.end();
});

test("create uses session owner and returns safe Farm fields", async () => {
  const created = await createFarm({ name: "  North Farm  " }, headersByUser[0]);
  assert.deepEqual(Object.keys(created).sort(), ["createdAt", "id", "name", "updatedAt"]);
  assert.equal(created.name, "North Farm");
  const [row] = await db.select().from(farm).where(eq(farm.id, created.id));
  assert.equal(row.ownerId, userIds[0]);
});

test("list, view, and update remain scoped to the owner", async () => {
  const mine = await createFarm({ name: "Mine" }, headersByUser[0]);
  const theirs = await createFarm({ name: "Theirs" }, headersByUser[1]);
  assert.ok((await listFarms(headersByUser[0])).some((item) => item.id === mine.id));
  assert.ok(!(await listFarms(headersByUser[0])).some((item) => item.id === theirs.id));
  assert.deepEqual(await getFarm(mine.id, headersByUser[0]), mine);
  assert.equal(await getFarm(theirs.id, headersByUser[0]), null);
  assert.equal(await updateFarm(theirs.id, { name: "Stolen" }, headersByUser[0]), null);
  assert.equal((await getFarm(theirs.id, headersByUser[1]))?.name, "Theirs");
  assert.equal((await updateFarm(mine.id, { name: "Renamed" }, headersByUser[0]))?.name, "Renamed");
  assert.equal((await getFarm(mine.id, headersByUser[0]))?.name, "Renamed");
  const unknown = randomUUID();
  assert.equal(await getFarm(unknown, headersByUser[0]), null);
  assert.equal(await updateFarm(unknown, { name: "Unknown" }, headersByUser[0]), null);
});

test("rejects invalid input and ignores forged ownership", async () => {
  for (const name of [" ", "x".repeat(101)]) {
    await assert.rejects(createFarm({ name }, headersByUser[0]), FarmValidationError);
  }
  await assert.rejects(createFarm({ name: "Forged", ownerId: userIds[1] }, headersByUser[0]), FarmValidationError);
  await assert.rejects(getFarm("malformed", headersByUser[0]), FarmValidationError);
  const mine = await createFarm({ name: "Safe" }, headersByUser[0]);
  await assert.rejects(updateFarm(mine.id, { name: "Forged", ownerId: userIds[1] }, headersByUser[0]), FarmValidationError);
  assert.equal((await getFarm(mine.id, headersByUser[0]))?.name, "Safe");
});

test("lists equal-time Farms in stable ID order", async () => {
  const first = await createFarm({ name: "First" }, headersByUser[0]);
  const second = await createFarm({ name: "Second" }, headersByUser[0]);
  const sameTime = new Date("2026-01-01T00:00:00Z");
  await db.update(farm).set({ createdAt: sameTime }).where(eq(farm.id, first.id));
  await db.update(farm).set({ createdAt: sameTime }).where(eq(farm.id, second.id));
  const listed = (await listFarms(headersByUser[0])).filter((item) => item.id === first.id || item.id === second.id);
  assert.deepEqual(listed.map((item) => item.id), [first.id, second.id].sort().reverse());
});

test("an ownership change before update prevents the former owner from writing", async () => {
  const created = await createFarm({ name: "Transferred" }, headersByUser[0]);
  await db.update(farm).set({ ownerId: userIds[1] }).where(eq(farm.id, created.id));
  assert.equal(await updateFarm(created.id, { name: "Former owner edit" }, headersByUser[0]), null);
  assert.equal((await getFarm(created.id, headersByUser[1]))?.name, "Transferred");
});

test("anonymous and expired sessions cannot read or write Farms", async () => {
  const mine = await createFarm({ name: "Session Farm" }, headersByUser[0]);
  await assert.rejects(createFarm({ name: "No" }, new Headers()), UnauthenticatedError);
  await assert.rejects(listFarms(new Headers()), UnauthenticatedError);
  await assert.rejects(getFarm(mine.id, new Headers()), UnauthenticatedError);
  await assert.rejects(updateFarm(mine.id, { name: "No" }, new Headers()), UnauthenticatedError);
  const [stored] = await db.select({ id: session.id }).from(session).where(eq(session.userId, userIds[1]));
  await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.id, stored.id));
  await assert.rejects(createFarm({ name: "Expired" }, headersByUser[1]), UnauthenticatedError);
  await assert.rejects(updateFarm(mine.id, { name: "Expired" }, headersByUser[1]), UnauthenticatedError);
});
