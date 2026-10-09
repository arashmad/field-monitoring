import { z } from "zod";

export const farmInputSchema = z.strictObject({
  name: z.string().trim().min(1, "Enter a farm name.").max(100, "Use 100 characters or fewer."),
});

export const farmIdSchema = z.uuid();

export type FarmInput = z.infer<typeof farmInputSchema>;
