import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Playwright が認証済みセッションを再利用するための storageState ファイルパス。
 *
 * global setup で magic link 経由でログインさせ、cookie を JSON で書き出す。
 * 実体は git 管理外 (`.gitignore` に `playwright/.auth/` を入れる)。
 */
export const ADMIN_STORAGE_STATE_PATH = "playwright/.auth/admin.json";

/**
 * E2E で実フローを叩くのに必要な env が揃っているか。
 *
 * これが false の場合、global setup は何もせず spec 側で test.skip() する。
 * CI で env を整える前 / ローカルで env 未設定の開発者でも smoke spec
 * だけは確実に通るようにするための gate。
 */
export function hasE2eAuthEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SECRET_KEY &&
      process.env.ADMIN_EMAIL,
  );
}

function getBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
}

/**
 * admin user の Supabase セッションを storageState ファイルに書き出す。
 *
 * 流れ:
 *   1. Supabase Admin API で `generateLink({ type: 'magiclink' })` を呼ぶ
 *   2. 返ってきた action_link (verify URL) を chromium で踏ませる
 *   3. `/auth/callback` 側で `exchangeCodeForSession` が走り cookie が貼られる
 *   4. `context.storageState({ path: ... })` で JSON として保存
 *
 * service role key (SUPABASE_SECRET_KEY) は **この fixture の中だけ** で参照する。
 * spec ファイル本体には漏らさない (.claude/rules/testing.md の方針)。
 *
 * env が揃っていない or 失敗時は warn してそのまま return する。
 * spec 側は `hasE2eAuthEnv()` を見て skip するため、ここで throw しない。
 */
export async function ensureAdminStorageState(): Promise<void> {
  if (!hasE2eAuthEnv()) {
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!supabaseUrl || !secretKey || !adminEmail) {
    return;
  }

  const baseUrl = getBaseUrl();

  try {
    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: adminEmail,
      options: { redirectTo: `${baseUrl}/auth/callback` },
    });

    if (error || !data?.properties?.action_link) {
      console.warn(
        `[e2e fixtures] generateLink failed: ${error?.message ?? "no action_link"}; admin specs will be skipped`,
      );
      return;
    }

    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(data.properties.action_link);
      // /auth/callback が exchangeCodeForSession を済ませて
      // / または ?next= で指定された場所へ redirect する。redirect 完了まで待つ。
      await page.waitForURL(
        (url) => !url.pathname.startsWith("/auth/callback"),
        {
          timeout: 30_000,
        },
      );
      await context.storageState({ path: ADMIN_STORAGE_STATE_PATH });
      await context.close();
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.warn(
      `[e2e fixtures] ensureAdminStorageState threw: ${err instanceof Error ? err.message : String(err)}; admin specs will be skipped`,
    );
  }
}
