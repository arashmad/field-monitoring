"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth-client";
import { signInSchema, type SignInValues } from "@/lib/sign-in-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function SignInForm() {
  // Prevent input before hydration: RHF would otherwise miss/reset those edits.
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const router = useRouter();
  const { register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInValues) {
    clearErrors("root");
    try {
      const { error } = await authClient.signIn.email(values);
      if (error) {
        setError("root", { message: error.status === 401 ? "Email or password is incorrect." : error.status === 429 ? "Too many attempts. Please wait and try again." : "Unable to sign in. Please try again." });
        return;
      }
      router.replace("/app");
      router.refresh();
    } catch {
      setError("root", { message: "Unable to sign in. Please try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={isSubmitting}>
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="username" required disabled={!hydrated || isSubmitting} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
          {errors.email && <FieldError id="email-error">{errors.email.message}</FieldError>}
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" type="password" autoComplete="current-password" required disabled={!hydrated || isSubmitting} aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined} {...register("password")} />
          {errors.password && <FieldError id="password-error">{errors.password.message}</FieldError>}
        </Field>
        {errors.root && <FieldError>{errors.root.message}</FieldError>}
        <Button type="submit" disabled={!hydrated || isSubmitting} className="w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
