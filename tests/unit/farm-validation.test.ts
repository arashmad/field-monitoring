import { farmIdSchema, farmInputSchema } from "@/features/farms/validation";

test("trims a valid Farm name", () => {
  expect(farmInputSchema.parse({ name: "  North Farm  " })).toEqual({ name: "North Farm" });
});

test.each(["", "   ", "a".repeat(101)])("rejects invalid Farm name %p", (name) => {
  expect(farmInputSchema.safeParse({ name }).success).toBe(false);
});

test("rejects a submitted owner ID", () => {
  expect(farmInputSchema.safeParse({ name: "North", ownerId: "someone-else" }).success).toBe(false);
});

test("accepts only UUID Farm IDs", () => {
  expect(farmIdSchema.safeParse("c45d9d74-eeb3-429a-ac12-416177968f2a").success).toBe(true);
  expect(farmIdSchema.safeParse("not-a-uuid").success).toBe(false);
});
