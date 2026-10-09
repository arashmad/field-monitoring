"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { UnauthenticatedError } from "@/lib/session";
import { createFarm, FarmValidationError, updateFarm } from "./service";

export type FarmActionState = { nameError: string; formError: string };

function actionError(error: unknown): FarmActionState {
  if (error instanceof FarmValidationError) {
    if (error.fieldErrors.id) notFound();
    return { nameError: error.fieldErrors.name ?? "", formError: "" };
  }
  if (error instanceof UnauthenticatedError) {
    return { nameError: "", formError: "Your session expired. Sign in and try again." };
  }
  return { nameError: "", formError: "Unable to save farm. Please try again." };
}

export async function createFarmAction(_previousState: FarmActionState, formData: FormData): Promise<FarmActionState> {
  let id: string;
  try {
    const created = await createFarm({ name: formData.get("name") });
    id = created.id;
  } catch (error) {
    return actionError(error);
  }
  revalidatePath("/app");
  redirect(`/app/farms/${id}`);
}

export async function updateFarmAction(id: string, _previousState: FarmActionState, formData: FormData): Promise<FarmActionState> {
  let found: Awaited<ReturnType<typeof updateFarm>>;
  try {
    found = await updateFarm(id, { name: formData.get("name") });
  } catch (error) {
    return actionError(error);
  }
  if (!found) notFound();
  revalidatePath("/app");
  revalidatePath(`/app/farms/${id}`);
  redirect(`/app/farms/${id}`);
}
