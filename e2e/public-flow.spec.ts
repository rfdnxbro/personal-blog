import { expect, test } from "@playwright/test";
import { hasE2eAuthEnv } from "./fixtures/auth";

/**
 * 未認証ユーザー視点の公開フロー。
 *
 * `pnpm db:seed` で admin と最小の post が入っている前提で、Supabase env が
 * 揃った環境 (ローカル / preview / env 整備後の CI) でだけ実フローを叩く。
 * env が無ければ test.skip() で安全に飛ばす (CI を赤くしない)。
 */
test.describe("public flow", () => {
  test.beforeAll(() => {
    test.skip(
      !hasE2eAuthEnv(),
      "Supabase env not configured; skipping public flow",
    );
  });

  test("home shows hero heading", async ({ page }) => {
    // Arrange + Act
    const response = await page.goto("/");

    // Assert
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "blog" })).toBeVisible();
  });

  test("posts index renders", async ({ page }) => {
    // Arrange + Act
    const response = await page.goto("/posts");

    // Assert
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "記事一覧" })).toBeVisible();
  });

  test("post detail renders article body", async ({ page }) => {
    // Arrange: 一覧から最初の post リンクを拾って詳細に遷移する
    await page.goto("/posts");
    const firstPostLink = page
      .getByRole("link")
      .filter({ hasText: /.+/ })
      .first();
    const linkCount = await page.getByRole("link").count();
    test.skip(
      linkCount === 0,
      "no published posts seeded; skipping detail check",
    );

    // Act
    await firstPostLink.click();
    await page.waitForURL(/\/posts\/[^/]+$/);

    // Assert
    await expect(page.locator("article")).toBeVisible();
    await expect(page.locator("article h1")).toBeVisible();
  });
});
