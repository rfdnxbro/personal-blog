import { ensureAdminStorageState } from "./fixtures/auth";

/**
 * Playwright global setup。
 *
 * - env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY / ADMIN_EMAIL) が
 *   全部揃っていれば magic link 経由で admin の storageState を生成する。
 * - 揃っていなければ何もせず return する (spec 側で `hasE2eAuthEnv()` を
 *   見て test.skip() する)。
 *
 * ここで throw すると smoke spec まで巻き込んで落ちるので、失敗は
 * `ensureAdminStorageState` 内で warn ログに留めて握りつぶす設計にしている。
 */
export default async function globalSetup(): Promise<void> {
  await ensureAdminStorageState();
}
