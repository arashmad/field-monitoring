import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { polygonSchema, type PolygonGeometry } from "./validation";

export type FieldSummary = {
  id: string;
  farmId: string;
  name: string;
  cropType: string;
  areaSqM: number;
  createdAt: Date;
  updatedAt: Date;
};

export type FieldRecord = FieldSummary & { geometry: PolygonGeometry };

type FieldRow = {
  id: string;
  farmId: string;
  name: string;
  cropType: string;
  areaSqM: number;
  createdAtMs: number | string;
  updatedAtMs: number | string;
  geojson: string;
};

function toRecord(row: FieldRow): FieldRecord {
  return {
    id: row.id,
    farmId: row.farmId,
    name: row.name,
    cropType: row.cropType,
    areaSqM: Number(row.areaSqM),
    createdAt: new Date(Number(row.createdAtMs)),
    updatedAt: new Date(Number(row.updatedAtMs)),
    geometry: polygonSchema.parse(JSON.parse(row.geojson)),
  };
}

function toSummary(row: Omit<FieldRow, "geojson">): FieldSummary {
  return {
    id: row.id,
    farmId: row.farmId,
    name: row.name,
    cropType: row.cropType,
    areaSqM: Number(row.areaSqM),
    createdAt: new Date(Number(row.createdAtMs)),
    updatedAt: new Date(Number(row.updatedAtMs)),
  };
}

export async function validPolygonTopology(geometry: PolygonGeometry): Promise<boolean> {
  const result = await db.execute(sql`
    WITH candidate AS (
      SELECT ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326) AS geom
    )
    SELECT ST_IsValid(geom) AND NOT ST_IsEmpty(geom)
      AND ST_Area(geom::geography) > 0 AS valid
    FROM candidate
  `);
  return result.rows[0]?.valid === true;
}

export async function insertFieldForOwnedFarm(ownerId: string, farmId: string, name: string, cropType: string, geometry: PolygonGeometry): Promise<FieldRecord | null> {
  const result = await db.execute(sql`
    INSERT INTO "field" ("farm_id", "name", "crop_type", "geometry")
    SELECT "farm"."id", ${name}, ${cropType},
      ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326)
    FROM "farm"
    WHERE "farm"."id" = ${farmId}::uuid AND "farm"."owner_id" = ${ownerId}
    RETURNING "id", "farm_id" AS "farmId", "name", "crop_type" AS "cropType",
      "area_sq_m" AS "areaSqM",
      EXTRACT(EPOCH FROM "created_at") * 1000 AS "createdAtMs",
      EXTRACT(EPOCH FROM "updated_at") * 1000 AS "updatedAtMs",
      ST_AsGeoJSON("geometry", 15) AS "geojson"
  `);
  return result.rows[0] ? toRecord(result.rows[0] as FieldRow) : null;
}

export async function ownedFarmExists(ownerId: string, farmId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM "farm" WHERE "id" = ${farmId}::uuid AND "owner_id" = ${ownerId} LIMIT 1
  `);
  return result.rows.length > 0;
}

export async function selectFieldsForOwnedFarm(ownerId: string, farmId: string): Promise<FieldSummary[]> {
  const result = await db.execute(sql`
    SELECT "field"."id", "field"."farm_id" AS "farmId", "field"."name",
      "field"."crop_type" AS "cropType", "field"."area_sq_m" AS "areaSqM",
      EXTRACT(EPOCH FROM "field"."created_at") * 1000 AS "createdAtMs",
      EXTRACT(EPOCH FROM "field"."updated_at") * 1000 AS "updatedAtMs"
    FROM "field" JOIN "farm" ON "farm"."id" = "field"."farm_id"
    WHERE "field"."farm_id" = ${farmId}::uuid AND "farm"."owner_id" = ${ownerId}
    ORDER BY "field"."created_at" DESC, "field"."id" DESC
  `);
  return result.rows.map((row) => toSummary(row as Omit<FieldRow, "geojson">));
}

export async function selectFieldForOwnedFarm(ownerId: string, farmId: string, fieldId: string): Promise<FieldRecord | null> {
  const result = await db.execute(sql`
    SELECT "field"."id", "field"."farm_id" AS "farmId", "field"."name",
      "field"."crop_type" AS "cropType", "field"."area_sq_m" AS "areaSqM",
      EXTRACT(EPOCH FROM "field"."created_at") * 1000 AS "createdAtMs",
      EXTRACT(EPOCH FROM "field"."updated_at") * 1000 AS "updatedAtMs",
      ST_AsGeoJSON("field"."geometry", 15) AS geojson
    FROM "field" JOIN "farm" ON "farm"."id" = "field"."farm_id"
    WHERE "field"."id" = ${fieldId}::uuid AND "field"."farm_id" = ${farmId}::uuid
      AND "farm"."owner_id" = ${ownerId}
  `);
  return result.rows[0] ? toRecord(result.rows[0] as FieldRow) : null;
}
