import { z } from "zod";

const longitude = z.number().finite().min(-180).max(180);
const latitude = z.number().finite().min(-85).max(85);
const positionSchema = z.tuple([longitude, latitude]);
const ringSchema = z.array(positionSchema).min(4);

export const polygonSchema = z.strictObject({
  type: z.literal("Polygon"),
  coordinates: z.array(ringSchema).min(1),
}).superRefine((polygon, context) => {
  let positions = 0;
  let minLongitude = Infinity;
  let maxLongitude = -Infinity;
  for (const [ringIndex, ring] of polygon.coordinates.entries()) {
    positions += ring.length;
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      context.addIssue({ code: "custom", message: "Each Polygon ring must be closed.", path: ["coordinates", ringIndex] });
    }
    for (const [lon] of ring) {
      minLongitude = Math.min(minLongitude, lon);
      maxLongitude = Math.max(maxLongitude, lon);
    }
  }
  if (positions > 5000) context.addIssue({ code: "custom", message: "Use 5000 positions or fewer.", path: ["coordinates"] });
  if (maxLongitude - minLongitude >= 180) {
    context.addIssue({ code: "custom", message: "Polygons crossing the antimeridian are not supported.", path: ["coordinates"] });
  }
});

export const fieldInputSchema = z.strictObject({
  name: z.string().trim().min(1, "Enter a field name.").max(100, "Use 100 characters or fewer."),
  cropType: z.string().trim().min(1, "Enter a crop type.").max(100, "Use 100 characters or fewer."),
  geometry: polygonSchema,
});

export const farmIdSchema = z.uuid();
export const fieldIdSchema = z.uuid();

export type PolygonGeometry = z.infer<typeof polygonSchema>;
export type FieldInput = z.infer<typeof fieldInputSchema>;
export type FieldErrors = { name?: string; cropType?: string; geometry?: string; farmId?: string; fieldId?: string };

export class FieldValidationError extends Error {
  readonly fieldErrors: FieldErrors;

  constructor(fieldErrors: FieldErrors) {
    super("Invalid Field input");
    this.name = "FieldValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function parseFieldInput(input: unknown): FieldInput {
  const parsed = fieldInputSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fieldErrors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (field === "name" || field === "cropType" || field === "geometry") {
      fieldErrors[field] ??= issue.message;
    } else {
      fieldErrors.geometry ??= "Remove unsupported Field properties.";
    }
  }
  throw new FieldValidationError(fieldErrors);
}
