# Authentication and ownership

Better Auth provides email/password authentication with PostgreSQL sessions.
The browser stores an HttpOnly session cookie. No JWT or browser token storage is
used. Public sign-up is disabled, including direct calls to the auth HTTP API.

## Local setup

Install dependencies and configure PostgreSQL as described in README.md.
Preserve an existing `.env`; add the auth variables from `.env.example`.
Generate a secret once:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the result in `BETTER_AUTH_SECRET` in your ignored `.env`, and set
`BETTER_AUTH_URL=http://localhost:3000`. It must match the browser origin exactly
(including hostname and port). Apply the committed migration:

```bash
pnpm db:migrate
pnpm auth:create-user --email grower@example.com --name "Grower"
pnpm dev
```

The provisioning command prompts for a hidden password of 8–128 characters.
It also accepts a password on stdin for automation; never pass passwords as CLI
arguments or commit them. It uses a separate, server-only Better Auth instance
that allows provisioning but is never exposed through HTTP. Existing accounts
are rejected and are not overwritten. Visit `/sign-in`, then `/app`.

Production requires a private secret and an HTTPS `BETTER_AUTH_URL`; use the real
site origin at build/runtime. Better Auth manages secure cookies, origin checks,
password hashing, and auth request rate limits. The default rate-limit store is
per-process memory; multiple app instances need shared rate limiting and trusted
client-IP forwarding configured before deployment.

## Session policy

- Sessions expire after seven days, with rolling renewal after one day of use.
- Server component identity reads do not renew sessions because they cannot set
  cookies. The shell's `SessionSync` requests the auth session endpoint on mount
  and focus through Better Auth's client, allowing expiry and cookie renewal.
- There is no background keepalive interval. An expired session requires sign-in.
- Cookie caching is disabled. Every protected server entry point consults the
  stored session, so expired/revoked tokens cannot grant access.
- Each sign-in creates a separate session. Sign-out revokes the current session;
  another device remains signed in. Better Auth supports revoking all sessions,
  but an account-management screen is outside ticket #3.

The policy provides rolling expiry rather than an absolute maximum lifetime.
Public registration, password reset, email verification delivery, and account
management are deferred; accounts are provisioned by a trusted administrator.

## Server ownership contract

`lib/session.ts` is server-only. `getCurrentUser()` returns `{ id, name, email }`
or `null`. `requireCurrentUser()` returns that identity or throws
`UnauthenticatedError`. Both accept explicit request headers for route handlers;
otherwise they read the current Next.js request. They never expose session tokens
or accept an owner identity from the browser.

Protected pages and layouts redirect unauthenticated callers to `/sign-in`.
Every future data operation must call `requireCurrentUser()` independently.
An API maps `UnauthenticatedError` to `401`; a server action returns a controlled
authentication failure. Other errors propagate to error handling and grant no
access. A layout check is not sufficient to authorize data operations.

For ticket #4, derive `ownerId` from the returned `user.id` and constrain queries
by it. Single-Farm reads/updates must include **both** Farm ID and owner ID;
Farm creation sets owner ID on the server. Field access later follows the owned
Farm. A missing or inaccessible resource should return the same not-found result.
Farm schema and cross-user resource tests belong to #4, not this auth ticket.

## Verification

Use a development/test database: auth and browser tests create unique disposable
accounts and remove them afterward. They do not alter existing user accounts.
All test runners and the E2E app use `NODE_ENV=test`, selecting `.env.test` and
falling back to `.env`; `.env.local` is ignored in tests. Explicit environment
variables take priority. To use a separate test database, put its configuration
and auth variables in `.env.test`, then run `NODE_ENV=test pnpm db:migrate` first.

```bash
pnpm db:check
pnpm lint
pnpm test:typecheck
pnpm test --runInBand
pnpm test:db
pnpm test:auth
pnpm test:e2e
```

`test:auth` uses Node's ESM test runner with tsx and the `react-server` condition
for server-only imports. It exercises the real auth adapter and session helper.
Jest remains the runner for unit tests and original DB connectivity checks.
Playwright starts a dedicated app on `http://127.0.0.1:3100`, overrides the auth
base URL to match it, and runs Chromium, Firefox, and WebKit serially.
