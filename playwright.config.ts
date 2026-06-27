import { defineConfig } from "@playwright/test";
import { ADMIN_STORAGE_STATE_PATH, hasE2eAuthEnv } from "./e2e/fixtures/auth";

// storageState は env が揃っているときだけ参照する。env が無い環境では
// global setup が何もせず admin spec も自分で skip するため、ここでも
// undefined を渡して Playwright が無い JSON ファイルを読みに行かないようにする。
// env が揃っていれば global setup が必ず ADMIN_STORAGE_STATE_PATH を生成するか
// warn して spec が skip される。
const adminStorageState = hasE2eAuthEnv()
  ? ADMIN_STORAGE_STATE_PATH
  : undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Phase 1 で E2E 件数が増えてアーティファクト容量が問題化したら、
    // "on-first-retry" への切り替え、または size 制限を検討する。
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    // 既存 smoke spec は storageState 無し / Supabase env 無しでも常時 PASS する。
    { name: "smoke", testMatch: /smoke\.spec\.ts/ },
    // 未認証ユーザー視点の公開フロー。Supabase env が無ければ spec 側で skip。
    { name: "public-flow", testMatch: /public-flow\.spec\.ts/ },
    // admin 認証済みフロー。global setup で magic link 経由に生成した storageState を再利用する。
    {
      name: "admin-flow",
      testMatch: /admin-flow\.spec\.ts/,
      use: { storageState: adminStorageState },
    },
  ],
});
