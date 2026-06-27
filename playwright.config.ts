import { defineConfig } from "@playwright/test";
import {
  ADMIN_STORAGE_STATE_PATH,
  hasAdminStorageState,
} from "./e2e/fixtures/auth";

// storageState は env が揃っている **かつ** ファイルが存在しているときだけ参照する。
//
// storageState の生成は Playwright プロセスでは行わない (SUPABASE_SECRET_KEY を
// Playwright プロセスに渡さない設計; .claude/rules/testing.md L66)。
// 代わりに `pnpm db:seed --emit-storage-state` (scripts/seed.ts) が生成する。
// env だけ揃っていてファイルが無いケースで `use.storageState` に存在しないパスを
// 渡してしまうと Playwright のバージョン次第で読み込みエラーになるため、
// ファイル存在も config 側で見て undefined に倒す。
const adminStorageState = hasAdminStorageState()
  ? ADMIN_STORAGE_STATE_PATH
  : undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
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
    // admin 認証済みフロー。`pnpm db:seed --emit-storage-state` が事前に生成した
    // storageState を再利用する。env or ファイルが無ければ spec 側で skip。
    {
      name: "admin-flow",
      testMatch: /admin-flow\.spec\.ts/,
      use: { storageState: adminStorageState },
    },
  ],
});
