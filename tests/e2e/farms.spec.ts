import { test as base, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";

function testIp() {
  return `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`;
}

const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": testIp() });
  },
});

type Account = { email: string; password: string };

function fixture(action: "create" | "expire" | "delete", account: Account) {
  execFileSync("pnpm", ["exec", "tsx", "--conditions=react-server", "tests/helpers/auth-fixture.mts"], {
    input: JSON.stringify({ action, ...account }),
    env: { ...process.env, BETTER_AUTH_URL: "http://127.0.0.1:3100" },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function newAccount(): Account {
  return { email: `e2e-${randomUUID()}@example.test`, password: randomUUID() };
}

async function signIn(page: Page, account: Account) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test("a grower creates, views, and renames a Farm", async ({ page }) => {
  const account = newAccount();
  fixture("create", account);
  try {
    await signIn(page, account);
    await expect(page.getByText("You have no farms yet.", { exact: false })).toBeVisible();
    await page.getByRole("textbox", { name: "Farm name" }).fill("   ");
    await page.getByRole("button", { name: "Create farm" }).click();
    await expect(page.getByText("Enter a farm name.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Farm name" })).toHaveValue("   ");
    await page.getByRole("textbox", { name: "Farm name" }).evaluate((element) => element.removeAttribute("maxlength"));
    await page.getByRole("textbox", { name: "Farm name" }).fill("x".repeat(101));
    await page.getByRole("button", { name: "Create farm" }).click();
    await expect(page.getByText("Use 100 characters or fewer.")).toBeVisible();
    await page.locator("form").evaluate((form) => {
      const forged = document.createElement("input");
      forged.type = "hidden";
      forged.name = "ownerId";
      forged.value = "another-user";
      form.appendChild(forged);
    });
    await page.getByRole("textbox", { name: "Farm name" }).fill("  North Farm  ");
    await page.getByRole("button", { name: "Create farm" }).click();
    await expect(page).toHaveURL(/\/app\/farms\/[a-f0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "North Farm" })).toBeVisible();
    await page.getByRole("textbox", { name: "Farm name" }).fill("South Farm");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "South Farm" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "South Farm" })).toBeVisible();
    await page.getByRole("link", { name: "All farms" }).click();
    await expect(page.getByRole("link", { name: "South Farm" })).toBeVisible();
  } finally {
    fixture("delete", account);
  }
});

test("another grower cannot see a Farm by list or guessed URL", async ({ browser }) => {
  const owner = newAccount();
  const stranger = newAccount();
  fixture("create", owner);
  fixture("create", stranger);
  const ownerContext = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": testIp() } });
  const strangerContext = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": testIp() } });
  try {
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerPage, owner);
    await ownerPage.getByRole("textbox", { name: "Farm name" }).fill("Private Farm");
    await ownerPage.getByRole("button", { name: "Create farm" }).click();
    await expect(ownerPage).toHaveURL(/\/app\/farms\/[a-f0-9-]+$/);
    const farmUrl = ownerPage.url();
    let updateRequest: { headers: Record<string, string>; body: Buffer } | undefined;
    ownerPage.on("request", (request) => {
      if (request.method() === "POST" && request.url() === farmUrl) {
        const body = request.postDataBuffer();
        if (body) updateRequest = { headers: request.headers(), body };
      }
    });
    await ownerPage.getByRole("textbox", { name: "Farm name" }).fill("Still Private");
    await ownerPage.getByRole("button", { name: "Save changes" }).click();
    await expect(ownerPage.getByRole("heading", { level: 1, name: "Still Private" })).toBeVisible();
    expect(updateRequest).toBeDefined();

    const strangerPage = await strangerContext.newPage();
    await signIn(strangerPage, stranger);
    await expect(strangerPage.getByText("Private Farm")).toHaveCount(0);
    const response = await strangerPage.goto(farmUrl);
    expect(response?.status()).toBe(404);
    await expect(strangerPage.getByRole("heading", { level: 1, name: "Private Farm" })).toHaveCount(0);
    const unknown = await strangerPage.goto(`/app/farms/${randomUUID()}`);
    expect(unknown?.status()).toBe(404);
    const denied = await strangerContext.request.post(farmUrl, {
      data: updateRequest!.body,
      headers: {
        "content-type": updateRequest!.headers["content-type"],
        "next-action": updateRequest!.headers["next-action"],
        origin: "http://127.0.0.1:3100",
      },
    });
    expect(denied.status()).toBe(404);
    await ownerPage.reload();
    await expect(ownerPage.getByRole("heading", { level: 1, name: "Still Private" })).toBeVisible();
  } finally {
    await ownerContext.close();
    await strangerContext.close();
    fixture("delete", owner);
    fixture("delete", stranger);
  }
});

test("an expired session cannot rename a Farm from an open form", async ({ page }) => {
  const account = newAccount();
  fixture("create", account);
  try {
    await signIn(page, account);
    await page.getByRole("textbox", { name: "Farm name" }).fill("Before");
    await page.getByRole("button", { name: "Create farm" }).click();
    await expect(page).toHaveURL(/\/app\/farms\/[a-f0-9-]+$/);
    fixture("expire", account);
    await page.getByRole("textbox", { name: "Farm name" }).fill("After");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Your session expired. Sign in and try again.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Before" })).toBeVisible();
  } finally {
    fixture("delete", account);
  }
});
