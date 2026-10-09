import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { farm } from "@/db/schemas/farm";

const publicFarmColumns = {
  id: farm.id,
  name: farm.name,
  createdAt: farm.createdAt,
  updatedAt: farm.updatedAt,
};

export type FarmRecord = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function insertFarm(ownerId: string, name: string): Promise<FarmRecord> {
  const [created] = await db.insert(farm).values({ ownerId, name }).returning(publicFarmColumns);
  return created;
}

export async function selectFarms(ownerId: string): Promise<FarmRecord[]> {
  return db.select(publicFarmColumns).from(farm).where(eq(farm.ownerId, ownerId))
    .orderBy(desc(farm.createdAt), desc(farm.id));
}

export async function selectFarm(ownerId: string, id: string): Promise<FarmRecord | null> {
  const [found] = await db.select(publicFarmColumns).from(farm)
    .where(and(eq(farm.id, id), eq(farm.ownerId, ownerId)));
  return found ?? null;
}

export async function renameFarm(ownerId: string, id: string, name: string): Promise<FarmRecord | null> {
  const [updated] = await db.update(farm).set({ name, updatedAt: new Date() })
    .where(and(eq(farm.id, id), eq(farm.ownerId, ownerId)))
    .returning(publicFarmColumns);
  return updated ?? null;
}
