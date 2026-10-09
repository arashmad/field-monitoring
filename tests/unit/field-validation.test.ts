import { FieldValidationError, farmIdSchema, fieldIdSchema, parseFieldInput } from "@/features/fields/validation";

const outer: [number, number][] = [[0, 0], [0.002, 0], [0.002, 0.002], [0, 0.002], [0, 0]];
const hole: [number, number][] = [[0.0005, 0.0005], [0.0005, 0.001], [0.001, 0.001], [0.001, 0.0005], [0.0005, 0.0005]];
const input = { name: "North", cropType: "Wheat", geometry: { type: "Polygon", coordinates: [outer] } };

function expectFieldError(candidate: unknown, field: keyof FieldValidationError["fieldErrors"]) {
  try {
    parseFieldInput(candidate);
    throw new Error("Expected FieldValidationError");
  } catch (error) {
    expect(error).toBeInstanceOf(FieldValidationError);
    expect((error as FieldValidationError).fieldErrors[field]).toBeTruthy();
  }
}

test("trims metadata and accepts a closed Polygon with a hole", () => {
  expect(parseFieldInput({ ...input, name: "  North  ", cropType: "  Wheat ", geometry: { type: "Polygon", coordinates: [outer, hole] } }))
    .toEqual({ name: "North", cropType: "Wheat", geometry: { type: "Polygon", coordinates: [outer, hole] } });
});

test.each([
  { name: " ", cropType: "Wheat", field: "name" },
  { name: "x".repeat(101), cropType: "Wheat", field: "name" },
  { name: "North", cropType: " ", field: "cropType" },
  { name: "North", cropType: "x".repeat(101), field: "cropType" },
] as const)("rejects invalid $field metadata", ({ name, cropType, field }) => {
  expectFieldError({ ...input, name, cropType }, field);
});

test.each([
  { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] },
  { type: "Polygon", coordinates: [[[0, 0, 10], [1, 0, 10], [1, 1, 10], [0, 0, 10]]] },
  { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, Infinity], [0, 0]]] },
  { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 86], [0, 0]]] },
  { type: "Polygon", coordinates: [[[179.9, 0], [-179.9, 0], [-179.9, 1], [179.9, 0]]] },
  { type: "MultiPolygon", coordinates: [[outer]] },
  { type: "Feature", geometry: { type: "Polygon", coordinates: [outer] }, properties: {} },
])("rejects malformed or unsupported geometry %#", (geometry) => {
  expectFieldError({ ...input, geometry }, "geometry");
});

test("rejects polygons with over 5000 positions", () => {
  const ring: [number, number][] = Array.from({ length: 5000 }, (_, i) => [i / 10000, 0]);
  ring.push(ring[0]);
  expectFieldError({ ...input, geometry: { type: "Polygon", coordinates: [ring] } }, "geometry");
});

test("rejects client-supplied owner and area", () => {
  expectFieldError({ ...input, ownerId: "forged" }, "geometry");
  expectFieldError({ ...input, areaSqM: 1 }, "geometry");
});

test("accepts only UUID Farm and Field IDs", () => {
  const valid = "bd55a978-ac70-4a5d-a6c9-b7e954b85aa0";
  expect(farmIdSchema.safeParse(valid).success).toBe(true);
  expect(fieldIdSchema.safeParse(valid).success).toBe(true);
  expect(farmIdSchema.safeParse("not-a-uuid").success).toBe(false);
  expect(fieldIdSchema.safeParse("not-a-uuid").success).toBe(false);
});
