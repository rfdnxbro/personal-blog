import { existsSync } from "node:fs";

/**
 * Playwright が認証済みセッションを再利用するための storageState ファイルパス。
 *
 * **生成は Playwright プロセスでは行わない**。
 * `pnpm db:seed --emit-storage-state` (scripts/seed.ts) が
 * `SUPABASE_SECRET_KEY` を使って magic-link 経由でログインさせ、cookie を
 * JSON に書き出す。Playwright プロセスには secret key を渡さず、ここで
 * ファイルの存在だけを確認する。
 *
 * 実体は git 管理外 (`.gitignore` に `playwright/.auth/` を入れる)。
 *
 * 設計判断: `.claude/rules/testing.md` L66「service role key を E2E で使わない」
 * を遵守するため、SUPABASE_SECRET_KEY の参照を seed プロセスに閉じる
 * (CLAUDE.md / PLAN.md の許可経路 = scripts/seed.ts + handle_new_user トリガー +
 * editors invite route の 3 箇所のうち scripts/seed.ts に乗せる)。
 */
export const ADMIN_STORAGE_STATE_PATH = "playwright/.auth/admin.json";

/**
 * E2E で実フローを叩くのに必要な env が **Playwright プロセス側で** 揃っているか。
 *
 * これが false の場合、spec 側で test.skip() する。
 * CI で env を整える前 / ローカルで env 未設定の開発者でも smoke spec
 * だけは確実に通るようにするための gate。
 *
 * **SUPABASE_SECRET_KEY は意図的にチェックしない**。secret key は seed
 * プロセス専用で、Playwright プロセスからは触らせない。
 *
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` は dev/preview server が
 * createBrowserClient/createServerClient で要求するため必須。
 */
export function hasE2eAuthEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.ADMIN_EMAIL,
  );
}

/**
 * admin storageState ファイルが (env 揃った上で) 存在しているか。
 *
 * `playwright.config.ts` で `use.storageState` に渡すかどうか、
 * および admin spec で test.skip するかどうかを決めるための共通判定。
 */
export function hasAdminStorageState(): boolean {
  return hasE2eAuthEnv() && existsSync(ADMIN_STORAGE_STATE_PATH);
}
