import { loadTestEnv } from "../helpers/test-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { eq, sql } from "drizzle-orm";

loadTestEnv();
process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { auth } = await import("../../lib/auth");
const { provisionUser } = await import("../../lib/provision-user");
const { db } = await import("../../db/client");
const { user, session } = await import("../../db/schemas/auth");
const { farm } = await import("../../db/schemas/farm");
const { UnauthenticatedError } = await import("../../lib/session");
const { FieldValidationError } = await import("../../features/fields/validation");
const { createField, listFields, getField } = await import("../../features/fields/service");

const password = "Test-password-42!";
const square = { type: "Polygon", coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]] };
const input = { name: "  North Field  ", cropType: " Wheat ", geometry: square };
const userIds: string[] = [];
const headersByUser: Headers[] = [];
const farmIds: string[] = [];

before(async () => {
  for (let i = 0; i < 2; i++) {
    const email = `fields-test-${randomUUID()}@example.test`;
    const account = await provisionUser({ name: "Field Test", email, password });
    userIds.push(account.id);
    const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    assert.equal(response.status, 200);
    headersByUser.push(new Headers({ cookie: response.headers.getSetCookie().map((item) => item.split(";")[0]).join("; ") }));
    const [createdFarm] = await db.insert(farm).values({ ownerId: account.id, name: `Farm ${i}` }).returning({ id: farm.id });
    farmIds.push(createdFarm.id);
  }
});

after(async () => {
  for (const id of userIds) await db.delete(user).where(eq(user.id, id));
  await db.$client.end();
});

async function fieldCount(): Promise<number> {
  const result = await db.execute(sql`SELECT count(*)::int AS count FROM field`);
  return Number(result.rows[0].count);
}

test("create persists a Polygon and server-derived area in its Farm", async () => {
  const created = await createField(farmIds[0], input, headersByUser[0]);
  assert.ok(created);
  assert.equal(created.farmId, farmIds[0]);
  assert.equal(created.name, "North Field");
  assert.equal(created.cropType, "Wheat");
  assert.deepEqual(created.geometry, square);
  assert.ok(created.areaSqM > 12000 && created.areaSqM < 12500);
  assert.ok(created.createdAt instanceof Date);
  assert.ok(created.updatedAt instanceof Date);
  const stored = await db.execute(sql`SELECT farm_id AS "farmId", area_sq_m AS "areaSqM" FROM field WHERE id = ${created.id}::uuid`);
  assert.equal(stored.rows[0].farmId, farmIds[0]);
  assert.equal(Number(stored.rows[0].areaSqM), created.areaSqM);
});

test("create preserves an interior hole and excludes it from area", async () => {
  const geometry = {
    type: "Polygon",
    coordinates: [
      square.coordinates[0],
      [[0.0002, 0.0002], [0.0002, 0.0008], [0.0008, 0.0008], [0.0008, 0.0002], [0.0002, 0.0002]],
    ],
  };
  const outer = await createField(farmIds[0], input, headersByUser[0]);
  const withHole = await createField(farmIds[0], { ...input, geometry }, headersByUser[0]);
  assert.ok(outer && withHole);
  assert.deepEqual(withHole.geometry, geometry);
  assert.ok(withHole.areaSqM > 0 && withHole.areaSqM < outer.areaSqM);
  assert.deepEqual((await getField(farmIds[0], withHole.id, headersByUser[0]))?.geometry, geometry);
});

test("create under foreign or unknown Farm writes nothing", async () => {
  const beforeCount = await fieldCount();
  assert.equal(await createField(farmIds[1], input, headersByUser[0]), null);
  assert.equal(await createField(randomUUID(), input, headersByUser[0]), null);
  assert.equal(await fieldCount(), beforeCount);
});

test("invalid topology and forged metadata return controlled errors without writes", async () => {
  const beforeCount = await fieldCount();
  const bowtie = { type: "Polygon", coordinates: [[[0, 0], [0.001, 0.001], [0, 0.001], [0.001, 0], [0, 0]]] };
  const outsideHole = { type: "Polygon", coordinates: [square.coordinates[0], [[0.01, 0.01], [0.011, 0.01], [0.011, 0.011], [0.01, 0.01]]] };
  const zeroArea = { type: "Polygon", coordinates: [[[0, 0], [0.001, 0], [0.002, 0], [0, 0]]] };
  for (const geometry of [bowtie, outsideHole, zeroArea]) {
    await assert.rejects(createField(farmIds[0], { ...input, geometry }, headersByUser[0]), (error: unknown) =>
      error instanceof FieldValidationError && Boolean(error.fieldErrors.geometry));
  }
  for (const forged of [{ ...input, ownerId: userIds[1] }, { ...input, areaSqM: 1 }, { ...input, geometry: { type: "MultiPolygon", coordinates: [] } }]) {
    await assert.rejects(createField(farmIds[0], forged, headersByUser[0]), FieldValidationError);
  }
  assert.equal(await fieldCount(), beforeCount);
});

test("anonymous and formerly-owned Farm cannot create a Field", async () => {
  await assert.rejects(createField(farmIds[0], input, new Headers()), UnauthenticatedError);
  const [moved] = await db.insert(farm).values({ ownerId: userIds[0], name: "Moved" }).returning({ id: farm.id });
  await db.update(farm).set({ ownerId: userIds[1] }).where(eq(farm.id, moved.id));
  assert.equal(await createField(moved.id, input, headersByUser[0]), null);
});

test("list returns only an owned Farm's Field summaries in stable order", async () => {
  const first = await createField(farmIds[0], { ...input, name: "First" }, headersByUser[0]);
  const second = await createField(farmIds[0], { ...input, name: "Second" }, headersByUser[0]);
  assert.ok(first && second);
  const [otherFarm] = await db.insert(farm).values({ ownerId: userIds[0], name: "Other" }).returning({ id: farm.id });
  const elsewhere = await createField(otherFarm.id, { ...input, name: "Elsewhere" }, headersByUser[0]);
  assert.ok(elsewhere);
  const listed = await listFields(farmIds[0], headersByUser[0]);
  assert.ok(listed);
  assert.ok(listed.some((field) => field.id === first.id));
  assert.ok(listed.some((field) => field.id === second.id));
  assert.ok(!listed.some((field) => field.id === elsewhere.id));
  assert.deepEqual(Object.keys(listed.find((field) => field.id === first.id)!).sort(),
    ["id", "farmId", "name", "cropType", "areaSqM", "createdAt", "updatedAt"].sort());
  const databaseOrder = await db.execute(sql`SELECT id FROM field WHERE farm_id = ${farmIds[0]}::uuid ORDER BY created_at DESC, id DESC`);
  assert.deepEqual(listed.map((field) => field.id), databaseOrder.rows.map((row) => row.id));
  const [emptyFarm] = await db.insert(farm).values({ ownerId: userIds[0], name: "Empty" }).returning({ id: farm.id });
  assert.deepEqual(await listFields(emptyFarm.id, headersByUser[0]), []);
});

test("get requires both the Field's Farm and its owner", async () => {
  const mine = await createField(farmIds[0], input, headersByUser[0]);
  const theirs = await createField(farmIds[1], input, headersByUser[1]);
  assert.ok(mine && theirs);
  assert.deepEqual(await getField(farmIds[0], mine.id, headersByUser[0]), mine);
  assert.equal(await getField(farmIds[0], theirs.id, headersByUser[0]), null);
  assert.equal(await getField(farmIds[1], mine.id, headersByUser[1]), null);
  assert.equal(await getField(farmIds[1], theirs.id, headersByUser[0]), null);
  assert.equal(await getField(farmIds[0], randomUUID(), headersByUser[0]), null);
  assert.equal(await getField(randomUUID(), mine.id, headersByUser[0]), null);
  assert.equal(await listFields(farmIds[1], headersByUser[0]), null);
  assert.equal(await listFields(randomUUID(), headersByUser[0]), null);
});

test("malformed IDs and missing sessions fail at the service boundary", async () => {
  await assert.rejects(listFields("invalid", headersByUser[0]), FieldValidationError);
  await assert.rejects(getField(farmIds[0], "invalid", headersByUser[0]), FieldValidationError);
  await assert.rejects(createField("invalid", input, headersByUser[0]), FieldValidationError);
  await assert.rejects(listFields(farmIds[0], new Headers()), UnauthenticatedError);
  await assert.rejects(getField(farmIds[0], randomUUID(), new Headers()), UnauthenticatedError);
});

test("a former Farm owner loses list and view access", async () => {
  const [moved] = await db.insert(farm).values({ ownerId: userIds[0], name: "Moved after Field" }).returning({ id: farm.id });
  const created = await createField(moved.id, input, headersByUser[0]);
  assert.ok(created);
  await db.update(farm).set({ ownerId: userIds[1] }).where(eq(farm.id, moved.id));
  assert.equal(await listFields(moved.id, headersByUser[0]), null);
  assert.equal(await getField(moved.id, created.id, headersByUser[0]), null);
  assert.equal((await getField(moved.id, created.id, headersByUser[1]))?.id, created.id);
});

test("an expired session cannot list or view Fields", async () => {
  const [stored] = await db.select({ id: session.id }).from(session).where(eq(session.userId, userIds[1]));
  await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(session.id, stored.id));
  await assert.rejects(listFields(farmIds[1], headersByUser[1]), UnauthenticatedError);
  await assert.rejects(getField(farmIds[1], randomUUID(), headersByUser[1]), UnauthenticatedError);
  await assert.rejects(createField(farmIds[1], input, headersByUser[1]), UnauthenticatedError);
});
