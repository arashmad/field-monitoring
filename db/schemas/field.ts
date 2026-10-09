import { sql } from "drizzle-orm";
import { check, customType, doublePrecision, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { farm } from "./farm";

const polygon = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Polygon,4326)";
  },
});

export const field = pgTable("field", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id").notNull().references(() => farm.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cropType: text("crop_type").notNull(),
  geometry: polygon("geometry").notNull(),
  areaSqM: doublePrecision("area_sq_m").generatedAlwaysAs(sql`ST_Area("field"."geometry"::geography)`).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("field_farm_id_idx").on(table.farmId),
  check("field_geometry_valid_check", sql`ST_IsValid(${table.geometry}) AND NOT ST_IsEmpty(${table.geometry})`),
  check("field_area_positive_check", sql`${table.areaSqM} > 0`),
  check("field_coordinate_bounds_check", sql`ST_XMin(${table.geometry}) >= -180 AND ST_XMax(${table.geometry}) <= 180 AND ST_YMin(${table.geometry}) >= -85 AND ST_YMax(${table.geometry}) <= 85`),
  check("field_longitude_span_check", sql`ST_XMax(${table.geometry}) - ST_XMin(${table.geometry}) < 180`),
]);
