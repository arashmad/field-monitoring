import { loadTestEnv } from "../helpers/test-env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { eq, sql } from "drizzle-orm";

loadTestEnv();
process.env.BETTER_AUTH_SECRET ??= "integration-test-secret-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

const { provisionUser } = await import("../../lib/provision-user");
const { db } = await import("../../db/client");
const { user } = await import("../../db/schemas/auth");
const { farm } = await import("../../db/schemas/farm");

const square = { type: "Polygon", coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001], [0, 0]]] };
const larger = { type: "Polygon", coordinates: [[[0, 0], [0.002, 0], [0.002, 0.002], [0, 0.002], [0, 0]]] };
let userId: string;
let farmId: string;

before(async () => {
  userId = (await provisionUser({ name: "Field Schema Test", email: `field-schema-${randomUUID()}@example.test`, password: "Test-password-42!" })).id;
  [ { id: farmId } ] = await db.insert(farm).values({ ownerId: userId, name: "Schema Farm" }).returning({ id: farm.id });
});

after(async () => {
  if (userId) await db.delete(user).where(eq(user.id, userId));
  await db.$client.end();
});

test("stores a WGS84 Polygon and derives spheroidal area from it", async () => {
  const inserted = await db.execute(sql`
    INSERT INTO field (farm_id, name, crop_type, geometry)
    VALUES (${farmId}::uuid, 'Square', 'Wheat', ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(square)}), 4326))
    RETURNING id, area_sq_m AS "areaSqM"
  `);
  const id = inserted.rows[0].id as string;
  const firstArea = Number(inserted.rows[0].areaSqM);
  assert.ok(firstArea > 12000 && firstArea < 12500);
  const checked = await db.execute(sql`
    SELECT ST_SRID(geometry) AS srid, GeometryType(geometry) AS type,
      area_sq_m AS "areaSqM", ST_Area(geometry::geography) AS expected
    FROM field WHERE id = ${id}::uuid
  `);
  assert.equal(checked.rows[0].srid, 4326);
  assert.equal(checked.rows[0].type, "POLYGON");
  assert.ok(Math.abs(Number(checked.rows[0].areaSqM) - Number(checked.rows[0].expected)) < 0.001);
  const updated = await db.execute(sql`
    UPDATE field SET geometry = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(larger)}), 4326)
    WHERE id = ${id}::uuid RETURNING area_sq_m AS "areaSqM"
  `);
  assert.ok(Number(updated.rows[0].areaSqM) > firstArea * 3.9);
});

test("stores Field timestamps with timezone", async () => {
  const columns = await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'field' AND column_name IN ('created_at', 'updated_at')
  `);
  assert.equal(columns.rows.length, 2);
  for (const column of columns.rows) assert.equal(column.data_type, "timestamp with time zone");
});

test("database rejects invalid, empty, wrong-CRS, and unsupported geometry", async () => {
  const invalid = { type: "Polygon", coordinates: [[[0, 0], [0.001, 0.001], [0, 0.001], [0.001, 0], [0, 0]]] };
  const zeroArea = { type: "Polygon", coordinates: [[[0, 0], [0.001, 0], [0.002, 0], [0, 0]]] };
  for (const geometry of [invalid, zeroArea]) {
    await assert.rejects(db.execute(sql`
      INSERT INTO field (farm_id, name, crop_type, geometry)
      VALUES (${farmId}::uuid, 'Invalid', 'Wheat', ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326))
    `));
  }
  await assert.rejects(db.execute(sql`
    INSERT INTO field (farm_id, name, crop_type, geometry)
    VALUES (${farmId}::uuid, 'Wrong SRID', 'Wheat', ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(square)}), 3857))
  `));
  await assert.rejects(db.execute(sql`
    INSERT INTO field (farm_id, name, crop_type, geometry)
    VALUES (${farmId}::uuid, 'Point', 'Wheat', ST_SetSRID(ST_Point(0, 0), 4326))
  `));
  await assert.rejects(db.execute(sql`
    INSERT INTO field (farm_id, name, crop_type, geometry)
    VALUES (${randomUUID()}::uuid, 'Orphan', 'Wheat', ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(square)}), 4326))
  `));
});

test("database enforces the supported geographic extent", async () => {
  const tooFarNorth = { type: "Polygon", coordinates: [[[0, 86], [0.001, 86], [0.001, 86.001], [0, 86.001], [0, 86]]] };
  const dateline = { type: "Polygon", coordinates: [[[179.9, 0], [-179.9, 0], [-179.9, 0.001], [179.9, 0]]] };
  for (const geometry of [tooFarNorth, dateline]) {
    await assert.rejects(db.execute(sql`
      INSERT INTO field (farm_id, name, crop_type, geometry)
      VALUES (${farmId}::uuid, 'Out of bounds', 'Wheat', ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326))
    `));
  }
});
