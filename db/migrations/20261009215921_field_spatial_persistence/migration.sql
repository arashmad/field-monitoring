CREATE TABLE "field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"crop_type" text NOT NULL,
	"geometry" geometry(Polygon,4326) NOT NULL,
	"area_sq_m" double precision GENERATED ALWAYS AS (ST_Area("field"."geometry"::geography)) STORED NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "field_geometry_valid_check" CHECK (ST_IsValid("geometry") AND NOT ST_IsEmpty("geometry")),
	CONSTRAINT "field_area_positive_check" CHECK ("area_sq_m" > 0),
	CONSTRAINT "field_coordinate_bounds_check" CHECK (ST_XMin("geometry") >= -180 AND ST_XMax("geometry") <= 180 AND ST_YMin("geometry") >= -85 AND ST_YMax("geometry") <= 85),
	CONSTRAINT "field_longitude_span_check" CHECK (ST_XMax("geometry") - ST_XMin("geometry") < 180)
);
--> statement-breakpoint
CREATE INDEX "field_farm_id_idx" ON "field" ("farm_id");--> statement-breakpoint
ALTER TABLE "field" ADD CONSTRAINT "field_farm_id_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE CASCADE;