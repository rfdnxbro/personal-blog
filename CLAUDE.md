# CLAUDE.md

Claude Code 向けプロジェクト規約。詳細仕様は [PLAN.md](./PLAN.md)、開発開始手順は [README.md](./README.md) を参照。

## スタック

- Next.js 16 (App Router) / React 19 / TypeScript 6
- Hono 4 (API レイヤ、`src/server/hono/` + Next の `src/app/api/[[...route]]/route.ts` でマウント)
- Supabase (Postgres + Auth + RLS)、`@supabase/ssr` で SSR セッション
- Tailwind CSS v4
- pnpm 11 / Node 22 / Vercel
- Biome 2 (lint + format) / Vitest 4 / Playwright 1.61
- lefthook (pre-commit) / GitHub Actions CI / Renovate (依存自動 merge)

## ディレクトリマップ

- `src/app/` — Next.js App Router (Server Component デフォルト)
- `src/app/api/[[...route]]/route.ts` — Hono への単一マウント点 (`runtime = 'nodejs'`)
- `src/server/hono/` — Hono アプリ本体、`app.ts` + `middleware/` + `routes/`
- `src/lib/` — Supabase クライアント (`supabase/{server,client,middleware}.ts`)、Markdown サニタイズ (`markdown.ts`)、zod スキーマ (`schemas.ts`)
- `src/components/` — UI コンポーネント
- `src/middleware.ts` — Next root middleware (認証ガード)
- `scripts/` — 運用スクリプト (`seed.ts` など、サーバ専用、service role key 利用可)
- `supabase/migrations/` — SQL マイグレーション (`NNNN_snake.sql`)
- `e2e/` — Playwright E2E
- `.claude/` — Claude Code ローカル規約 (`rules/`, `skills/`, `settings.json`)

## 実装規約

- **Hono ルートは `src/app/api/[[...route]]/route.ts` で 1 箇所だけマウント**。`export const runtime = 'nodejs'` 必須 (`@supabase/ssr` の cookie 操作が edge では崩れる)
- **Hono の route 追加**: `src/server/hono/routes/<name>.ts` を新規作成し、`app.ts` のバレル (`routes/*.ts` を自動 import + 統一登録) に乗せる。新規 route 追加 PR では `app.ts` を直接いじらない (PR 並列化時の衝突回避)
- **Supabase クライアント**: `@supabase/ssr` の `createServerClient` / `createBrowserClient` を経由 (`src/lib/supabase/`)。`@supabase/supabase-js` を Next コンポーネントから直接呼ばない
- **`SUPABASE_SERVICE_ROLE_KEY` はサーバ専用**。`src/lib/supabase/client.ts` および `'use client'` 配下のモジュールから絶対参照しない。利用箇所は `scripts/` と `src/server/hono/` のみ
- **Markdown は必ずサニタイズ**: `src/lib/markdown.ts` の unified pipeline (`remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-sanitize` → `rehype-stringify`) を経由。`dangerouslySetInnerHTML` で生 HTML を直接出さない
- **RLS 既定 ON**: 全テーブルで `enable row level security`。`disable row level security` を書かない
- **マイグレーション命名**: `supabase/migrations/NNNN_snake_case.sql` (例: `0003_handle_new_user.sql`)。連番で順序保証
- **環境変数**: 機密は `.env.local` (gitignore)、本番は Vercel env、CI は GitHub Actions secrets。**実メール・キーは絶対コミットしない**
- **Server Component 優先**: `'use client'` は最小限 (フォームの onChange やインタラクティブ UI のみ)
- **`next/image` と `next/link`**: 生 `<img>` / `<a href>` で同等処理を書かない (Biome に Next 用ルールが無いため、規約で担保)

## 主要コマンド (pnpm)

| Command | 用途 |
|---|---|
| `pnpm dev` | Next.js 開発サーバ |
| `pnpm build` | 本番ビルド |
| `pnpm start` | 本番モード起動 |
| `pnpm lint` | Biome 検査 (`biome check .`) |
| `pnpm format` | Biome 整形 (`biome check --write .`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (CI モード) |
| `pnpm test:watch` | Vitest watch |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm db:seed` | 初期 admin 投入 (`tsx scripts/seed.ts`、`ADMIN_EMAIL` 必須) |

## TDD ワークフロー (red → green → refactor)

1. **red**: 期待する挙動の Vitest / Playwright を先に書き、`pnpm test` が失敗することを確認
2. **green**: 失敗テストを通す最小実装
3. **refactor**: 重複削減・命名改善。テストは緑のまま
4. 完了前に必ず `pnpm lint && pnpm typecheck && pnpm test` を通してから PR を開く

## PR 運用

- **Conventional Commits**: `feat:` / `fix:` / `chore:` / `test:` / `docs:` / `refactor:`
- **1 PR = 1 関心事**、差分目安 ≲ 400 行 (生成物・lockfile 除く)
- **squash merge**、ブランチ名 `feat/<name>` / `chore/<name>` / `fix/<name>` / `test/<name>`
- **CI 緑が merge 条件**。`gh pr create --fill` + `gh pr merge --squash --auto` で自動 merge を活用
- 機能 PR は必ず対応するテスト (Vitest / Playwright) を同梱
- 並列実装は Dynamic Workflow (`Workflow` ツール、`isolation: 'worktree'`) で各 PR を独立 worktree に隔離

## 補助規約

- ルール: [.claude/rules/](./.claude/rules/) — path スコープ付き (testing, api, supabase, components)
- スキル: [.claude/skills/](./.claude/skills/) — 定型手順 (new-migration, new-feature-tdd, new-api-route)
- Claude Code hook (`.claude/settings.json`): `*.{ts,tsx,json,jsonc,css}` 編集時に `pnpm exec biome check --write` が自動適用される
