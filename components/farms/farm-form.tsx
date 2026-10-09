"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FarmActionState } from "@/features/farms/actions";

const initialFarmActionState: FarmActionState = { nameError: "", formError: "" };

type Props = {
  mode: "create" | "edit";
  initialName?: string;
  action: (state: FarmActionState, formData: FormData) => Promise<FarmActionState>;
};

export function FarmForm({ mode, initialName = "", action }: Props) {
  const [name, setName] = useState(initialName);
  const [state, formAction, pending] = useActionState(action, initialFarmActionState);
  return (
    <form action={formAction} noValidate aria-busy={pending} className="max-w-md space-y-4">
      <FieldGroup>
        <Field data-invalid={!!state.nameError}>
          <FieldLabel htmlFor={`farm-name-${mode}`}>Farm name</FieldLabel>
          <Input id={`farm-name-${mode}`} name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100}
            disabled={pending} aria-invalid={!!state.nameError}
            aria-describedby={state.nameError ? `farm-name-${mode}-error` : undefined} />
          {state.nameError && <FieldError id={`farm-name-${mode}-error`}>{state.nameError}</FieldError>}
        </Field>
        {state.formError && <FieldError role="alert">{state.formError}</FieldError>}
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create farm" : "Save changes"}</Button>
      </FieldGroup>
    </form>
  );
}
