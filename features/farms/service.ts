import "server-only";

import { ZodError } from "zod";
import { requireCurrentUser } from "@/lib/session";
import { insertFarm, selectFarms, selectFarm, renameFarm, type FarmRecord } from "./data";
import { farmIdSchema, farmInputSchema } from "./validation";

export type { FarmRecord } from "./data";

export class FarmValidationError extends Error {
  readonly fieldErrors: { name?: string; id?: string };

  constructor(fieldErrors: { name?: string; id?: string }) {
    super("Invalid Farm input");
    this.name = "FarmValidationError";
    this.fieldErrors = fieldErrors;
  }
}

function parseInput(input: unknown): { name: string } {
  try {
    return farmInputSchema.parse(input);
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    throw new FarmValidationError({ name: error.issues[0]?.message ?? "Enter a valid farm name." });
  }
}

function parseId(id: unknown): string {
  const parsed = farmIdSchema.safeParse(id);
  if (!parsed.success) throw new FarmValidationError({ id: "Invalid farm ID." });
  return parsed.data;
}

export async function createFarm(input: unknown, requestHeaders?: Headers): Promise<FarmRecord> {
  const owner = await requireCurrentUser(requestHeaders);
  return insertFarm(owner.id, parseInput(input).name);
}

export async function listFarms(requestHeaders?: Headers): Promise<FarmRecord[]> {
  const owner = await requireCurrentUser(requestHeaders);
  return selectFarms(owner.id);
}

export async function getFarm(id: unknown, requestHeaders?: Headers): Promise<FarmRecord | null> {
  const owner = await requireCurrentUser(requestHeaders);
  return selectFarm(owner.id, parseId(id));
}

export async function updateFarm(id: unknown, input: unknown, requestHeaders?: Headers): Promise<FarmRecord | null> {
  const owner = await requireCurrentUser(requestHeaders);
  return renameFarm(owner.id, parseId(id), parseInput(input).name);
}
