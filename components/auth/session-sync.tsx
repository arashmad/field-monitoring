"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SessionSync() {
  const router = useRouter();
  // The handler can renew the database session AND Set-Cookie. No keepalive polling.
  const { data, isPending, error } = authClient.useSession();
  useEffect(() => {
    if (!isPending && !error && !data) {
      router.replace("/sign-in");
      router.refresh();
    }
  }, [data, isPending, error, router]);
  return null;
}
