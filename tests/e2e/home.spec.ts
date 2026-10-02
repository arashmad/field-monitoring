import { test, expect } from "@playwright/test";

test("homepage loads with a heading and documentation link", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Documentation", exact: true }),
  ).toHaveAttribute("href", /^https:\/\/nextjs\.org\/docs(?:\?|$)/);
});
