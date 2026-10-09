import "server-only";

import { requireCurrentUser } from "@/lib/session";
import { insertFieldForOwnedFarm, ownedFarmExists, selectFieldForOwnedFarm, selectFieldsForOwnedFarm, validPolygonTopology, type FieldRecord, type FieldSummary } from "./data";
import { farmIdSchema, fieldIdSchema, FieldValidationError, parseFieldInput } from "./validation";

export type { FieldRecord, FieldSummary } from "./data";

function parseFarmId(id: unknown): string {
  const parsed = farmIdSchema.safeParse(id);
  if (!parsed.success) throw new FieldValidationError({ farmId: "Invalid farm ID." });
  return parsed.data;
}

function parseFieldId(id: unknown): string {
  const parsed = fieldIdSchema.safeParse(id);
  if (!parsed.success) throw new FieldValidationError({ fieldId: "Invalid field ID." });
  return parsed.data;
}

export async function createField(farmId: unknown, input: unknown, requestHeaders?: Headers): Promise<FieldRecord | null> {
  const owner = await requireCurrentUser(requestHeaders);
  const parsedFarmId = parseFarmId(farmId);
  const fieldInput = parseFieldInput(input);
  if (!await validPolygonTopology(fieldInput.geometry)) {
    throw new FieldValidationError({ geometry: "Enter a valid Polygon boundary." });
  }
  return insertFieldForOwnedFarm(owner.id, parsedFarmId, fieldInput.name, fieldInput.cropType, fieldInput.geometry);
}

export async function listFields(farmId: unknown, requestHeaders?: Headers): Promise<FieldSummary[] | null> {
  const owner = await requireCurrentUser(requestHeaders);
  const parsedFarmId = parseFarmId(farmId);
  if (!await ownedFarmExists(owner.id, parsedFarmId)) return null;
  return selectFieldsForOwnedFarm(owner.id, parsedFarmId);
}

export async function getField(farmId: unknown, fieldId: unknown, requestHeaders?: Headers): Promise<FieldRecord | null> {
  const owner = await requireCurrentUser(requestHeaders);
  return selectFieldForOwnedFarm(owner.id, parseFarmId(farmId), parseFieldId(fieldId));
}
