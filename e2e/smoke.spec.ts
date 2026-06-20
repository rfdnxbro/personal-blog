import { expect, test } from "@playwright/test";

test("home renders the blog heading", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "blog" })).toBeVisible();
});
