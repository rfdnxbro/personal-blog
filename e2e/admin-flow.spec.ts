import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ADMIN_STORAGE_STATE_PATH, hasE2eAuthEnv } from "./fixtures/auth";

/**
 * admin 認証済みフロー。
 *
 * storageState は global setup で magic link 経由で生成済み (cookie のみ JSON 化)。
 * service role key は spec 内で参照しない (fixture/global-setup 内に閉じる)。
 *
 * env が無い or storageState が無い場合は test.skip() で全部飛ばす。
 */
test.describe("admin flow", () => {
  test.beforeAll(() => {
    test.skip(
      !hasE2eAuthEnv(),
      "Supabase env not configured; skipping admin flow",
    );
    test.skip(
      !existsSync(ADMIN_STORAGE_STATE_PATH),
      "admin storageState not generated; skipping admin flow",
    );
  });

  test("admin can view posts list", async ({ page }) => {
    // Arrange + Act
    const response = await page.goto("/admin/posts");

    // Assert
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "記事管理" })).toBeVisible();
  });

  test("admin can create a draft post", async ({ page }) => {
    // Arrange
    await page.goto("/admin/posts/new");
    const title = `E2E draft ${Date.now()}`;

    // Act
    await page.getByLabel("タイトル").fill(title);
    await page
      .getByLabel("Markdown")
      .fill("# heading\n\nE2E で投入した下書き本文。");
    await page.getByRole("button", { name: "下書き保存" }).click();

    // Assert: 一覧に戻ってタイトルが見える
    await page.waitForURL(/\/admin\/posts(\?.*)?$/);
    await expect(page.getByRole("heading", { name: "記事管理" })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("admin can publish a post and it appears on public index", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/admin/posts/new");
    const title = `E2E published ${Date.now()}`;

    // Act
    await page.getByLabel("タイトル").fill(title);
    await page
      .getByLabel("Markdown")
      .fill("# heading\n\nE2E で投入した公開記事本文。");
    await page.getByRole("button", { name: "公開" }).click();

    // Assert: 一覧に戻ったあと公開記事一覧に出る
    await page.waitForURL(/\/admin\/posts(\?.*)?$/);
    await page.goto("/posts");
    await expect(page.getByText(title)).toBeVisible();
  });
});
