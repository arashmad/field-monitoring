import "server-only";

import { headers } from "next/headers";
import { auth } from "./auth";

export type CurrentUser = { id: string; name: string; email: string };

export class UnauthenticatedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthenticatedError";
  }
}

export async function getCurrentUser(requestHeaders?: Headers): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({
    headers: requestHeaders ?? await headers(),
    // RSCs cannot set cookies. Renew via the browser's auth handler instead.
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!session) return null;
  const { id, name, email } = session.user;
  return { id, name, email };
}

export async function requireCurrentUser(requestHeaders?: Headers): Promise<CurrentUser> {
  const user = await getCurrentUser(requestHeaders);
  if (!user) throw new UnauthenticatedError();
  return user;
}
