import { test as base, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID, randomInt } from "node:crypto";

type Account = { email: string; password: string };
function fixture(action: "create" | "expire" | "age" | "delete", account: Account) {
  execFileSync("pnpm", ["exec", "tsx", "--conditions=react-server", "tests/helpers/auth-fixture.mts"], {
    input: JSON.stringify({ action, ...account }),
    env: { ...process.env, BETTER_AUTH_URL: "http://127.0.0.1:3100" },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

const test = base.extend<{ account: Account }>({
  extraHTTPHeaders: async ({}, provide) => {
    // Each test simulates an independent client, preserving real rate limits.
    await provide({ "x-forwarded-for": `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}` });
  },
  account: async ({}, provide) => {
    const account = { email: `e2e-${randomUUID()}@example.test`, password: randomUUID() };
    fixture("create", account);
    try { await provide(account); } finally { fixture("delete", account); }
  },
});

async function signIn(page: Page, account: Account) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("anonymous direct access redirects to sign-in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Application" })).toHaveCount(0);
});

test("forged session cookie cannot render the protected shell", async ({ page, context }) => {
  await context.addCookies([{ name: "better-auth.session_token", value: "forged-token", url: "http://127.0.0.1:3100" }]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign-in, persistence and sign-out enforce the server boundary", async ({ page, account, context }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect." })).toBeVisible();
  await signIn(page, account);
  await expect(page.getByRole("heading", { name: "Welcome, Test Grower" })).toBeVisible();
  await expect(page.getByText(account.email, { exact: true })).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === "better-auth.session_token")?.httpOnly).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome, Test Grower" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("an expired stored session redirects even with its cookie still present", async ({ page, account }) => {
  await signIn(page, account);
  fixture("expire", account);
  await page.reload();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a session request renews an aged session cookie", async ({ page, account }) => {
  await signIn(page, account);
  fixture("age", account);
  // This is the same HTTP endpoint used by SessionSync on mount/focus.
  const response = await page.request.get("/api/auth/get-session");
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toMatch(/session_token=.*Max-Age=604800/i);
  const body = await response.json();
  expect(new Date(body.session.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6.9 * 86400_000);
});
