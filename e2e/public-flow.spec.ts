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
    // Arrange: 一覧から最初の post リンクを拾って詳細に遷移する。
    // layout に nav 等が増えても拾わないよう、posts/page.tsx 側の
    // post 一覧 <ul> に付けた data-testid 内に限定する。
    await page.goto("/posts");
    const postList = page.getByTestId("post-list");
    const firstPostLink = postList.getByRole("link").first();
    const linkCount = await postList.getByRole("link").count();
    test.skip(
      linkCount === 0,
      "no published posts seeded; skipping detail check",
    );

    // Act
    await firstPostLink.click();
    await page.waitForURL(/\/posts\/[^/]+$/);

    // Assert: CSS セレクタを使わず role 経由で記事本体と見出しを取得する
    // (.claude/rules/testing.md「locator の選び方」優先度)。
    await expect(page.getByRole("article")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  // 匿名コメント投稿フロー (PR-C CommentForm) の E2E カバレッジは Phase 2 送り。
  // 理由:
  //   1. CommentForm はまだ src/app/posts/[slug]/page.tsx に差し込まれていない
  //      (PR-C の Server Component 統合が未着手)
  //   2. CommentForm の `verifyTurnstile` は TURNSTILE_SECRET_KEY 未設定で
  //      fail closed (400) するため、ローカル / CI で実フローを踏ませるには
  //      env 注入か bypass フラグの設計が要る (現状は未実装)
  // この PR の commit message / PR description でも「コメント送信フローは
  // Phase 2 送り」と明示する。
  test.skip("anonymous comment submission appears in CommentList (Phase 2)", () => {});
});
