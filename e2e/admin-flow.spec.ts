import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { hasAdminStorageState, hasE2eAuthEnv } from "./fixtures/auth";

/**
 * admin 認証済みフロー。
 *
 * storageState は `pnpm db:seed --emit-storage-state` (scripts/seed.ts) で
 * 事前生成しておく。Playwright プロセスには SUPABASE_SECRET_KEY を渡さない
 * (.claude/rules/testing.md L66「service role key を E2E で使わない」)。
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
      !hasAdminStorageState(),
      "admin storageState not generated; skipping admin flow (run `pnpm db:seed --emit-storage-state` first)",
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
    // Arrange: title は uuid 混ぜで衝突を避ける (slug 自動生成の unique 違反対策)
    await page.goto("/admin/posts/new");
    const title = `E2E draft ${Date.now()}-${randomUUID().slice(0, 8)}`;

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
    // Arrange: title は uuid 混ぜで衝突を避ける (slug 自動生成の unique 違反対策)
    await page.goto("/admin/posts/new");
    const title = `E2E published ${Date.now()}-${randomUUID().slice(0, 8)}`;

    // Act
    await page.getByLabel("タイトル").fill(title);
    await page
      .getByLabel("Markdown")
      .fill("# heading\n\nE2E で投入した公開記事本文。");
    await page.getByRole("button", { name: "公開" }).click();

    // Assert: 一覧に戻ったあと公開記事一覧に link role で現れる
    // (link role 経由は auto-retry assertion が効き、単純な text match より
    // 記事 list との具体性が高い)
    await page.waitForURL(/\/admin\/posts(\?.*)?$/);
    await page.goto("/posts");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });
});
