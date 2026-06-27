// tsx 経由の直接実行では Next.js の env 自動読み込みが効かないため明示的に .env を読む
import "dotenv/config";

import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";

// secret-key: seed only — server-only は付けない (tsx 直接実行で throw する); Node API で import 経路を閉じる

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// E2E 用 admin storageState の出力先。
// Playwright プロセスはこのファイルを読み込むだけで、SUPABASE_SECRET_KEY を
// 一切参照しない設計 (`.claude/rules/testing.md` L66「service role key を E2E で使わない」遵守)。
const ADMIN_STORAGE_STATE_PATH = "playwright/.auth/admin.json";

function fail(msg: string): never {
  console.error(`[seed] ${msg}`);
  process.exit(1);
}

async function seedAdmin(): Promise<void> {
  if (!SUPABASE_URL) fail("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!SUPABASE_SECRET_KEY) fail("SUPABASE_SECRET_KEY is not set");
  if (!ADMIN_EMAIL) fail("ADMIN_EMAIL is not set");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("editors")
    .upsert(
      {
        email: ADMIN_EMAIL,
        role: "admin",
        display_name: "admin",
      },
      { onConflict: "email_normalized", ignoreDuplicates: false },
    )
    .select()
    .single();

  if (error) {
    fail(`upsert failed: ${error.message}`);
  }
  console.log(`[seed] admin ready: id=${data.id} email=${ADMIN_EMAIL}`);
}

/**
 * E2E 用の admin storageState を生成する (--emit-storage-state 時のみ実行)。
 *
 * 流れ:
 *   1. Supabase Admin API で `generateLink({ type: 'magiclink' })` を呼ぶ
 *   2. 返ってきた action_link (verify URL) を chromium で踏ませる
 *   3. `/auth/callback` 側で `exchangeCodeForSession` が走り cookie が貼られる
 *   4. `context.storageState({ path: ... })` で JSON として保存
 *
 * **SUPABASE_SECRET_KEY はこの関数 (= seed プロセス) でだけ参照する**。
 * Playwright プロセスには渡さず、Playwright は出力された JSON を読むだけ。
 *
 * 古い storageState は冒頭で必ず unlink する (期限切れ session を握ったまま
 * admin spec が中途半端に通る flake を避けるため)。生成に失敗した場合は
 * ファイル無しの状態で終了し、spec 側は `existsSync` で skip する。
 *
 * 前提:
 *   - dev / preview server が `${PLAYWRIGHT_BASE_URL ?? http://localhost:3000}` で
 *     起動していること (auth/callback を踏ませるため)
 *   - `seedAdmin()` で editors 行が事前に投入されていること
 */
async function emitStorageState(): Promise<void> {
  if (!SUPABASE_URL) fail("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!SUPABASE_SECRET_KEY) fail("SUPABASE_SECRET_KEY is not set");
  if (!ADMIN_EMAIL) fail("ADMIN_EMAIL is not set");

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  // 古い storageState は先に消す。失敗時はファイル無しの状態で抜けるため、
  // spec 側で existsSync が false となり test.skip() に倒れる。
  await rm(ADMIN_STORAGE_STATE_PATH, { force: true });
  await mkdir(dirname(ADMIN_STORAGE_STATE_PATH), { recursive: true });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: ADMIN_EMAIL,
    options: { redirectTo: `${baseUrl}/auth/callback` },
  });

  if (error || !data?.properties?.action_link) {
    fail(`generateLink failed: ${error?.message ?? "no action_link"}`);
  }

  // chromium は --emit-storage-state パスでだけ動的 import する。
  // 通常 seed (editors upsert のみ) のときに browser を起動させない。
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(data.properties.action_link);
    // /auth/callback が exchangeCodeForSession を済ませて / または ?next= で
    // 指定された場所へ redirect する。redirect 完了まで待つ。
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/callback"), {
      timeout: 30_000,
    });
    await context.storageState({ path: ADMIN_STORAGE_STATE_PATH });
    await context.close();
    console.log(`[seed] storageState ready: ${ADMIN_STORAGE_STATE_PATH}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const emitStorage = args.includes("--emit-storage-state");

  await seedAdmin();
  if (emitStorage) {
    await emitStorageState();
  }
}

// tsx の CJS 経路で top-level await が禁止されるため main().catch() 形式にする
main().catch((err) => {
  console.error(`[seed] unexpected error: ${err}`);
  process.exit(1);
});
