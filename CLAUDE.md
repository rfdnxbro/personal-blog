# CLAUDE.md

Claude Code 向けプロジェクト規約。詳細仕様は [PLAN.md](./PLAN.md)、開発開始手順は [README.md](./README.md) を参照。

**現状 (Phase 0 完了直後)**: コード本体はまだ `src/app/` 配下のスケルトンのみ。本書のディレクトリマップ・実装規約は **Phase 1 で追加されるファイル群に適用** される。Phase 1 着手時はまず [PLAN.md の「アーキテクチャ判断」セクション](./PLAN.md#アーキテクチャ判断-phase-1-着手前に固める) を読み、認可 / サニタイズ / Hono 採用理由の前提を踏まえてから実装に入ること。

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
- `scripts/` — 運用スクリプト (`seed.ts` などのサーバ専用ユーティリティ。`SUPABASE_SERVICE_ROLE_KEY` の利用可否は下記実装規約で経路限定)
- `supabase/migrations/` — SQL マイグレーション (`NNNN_snake.sql`)
- `e2e/` — Playwright E2E
- `.claude/` — Claude Code ローカル規約 (`rules/`, `skills/`, `settings.json`)

## 実装規約

- **認可は RLS が唯一の真実の源**。Hono / Next middleware で認可判定を二重実装しない。Hono は zod 検証 + Supabase セッション取り出し + 複合トランザクション + エラーマッピングだけを担う薄層 (詳細は [PLAN.md](./PLAN.md#認可レイヤ-rls-が唯一の真実の源))
- **サニタイズは表示時の単一入口** `src/lib/markdown.ts` の `renderMarkdownToSafeHtml()` に集約。保存は生 Markdown のまま、コメント本文は plain text + 改行のみで Markdown 描画しない (詳細は [PLAN.md](./PLAN.md#サニタイズ責務-表示時単一入口))
- **Hono ルートは `src/app/api/[[...route]]/route.ts` で 1 箇所だけマウント**。`export const runtime = 'nodejs'` 必須 (`@supabase/ssr` の cookie 操作が edge では崩れる)
- **Hono の route 追加**: `src/server/hono/routes/<name>.ts` を新規作成し、`app.ts` のバレル (`routes/*.ts` を自動 import + 統一登録) に乗せる。新規 route 追加 PR では `app.ts` を直接いじらない (PR 並列化時の衝突回避)
- **Supabase クライアント**: `@supabase/ssr` の `createServerClient` / `createBrowserClient` を経由 (`src/lib/supabase/`)。Hono は `createServerClient` の authenticated client 経由のみ。`@supabase/supabase-js` を Next コンポーネントから直接呼ばない
- **`SUPABASE_SERVICE_ROLE_KEY` はサーバ専用 + 経路を絞る**。利用箇所は `scripts/seed.ts` と `auth.users` トリガー内、招待時の `auth.admin.inviteUserByEmail` 1 箇所のみ。`src/lib/supabase/client.ts` および `'use client'` 配下のモジュールから絶対参照しない
- **`import 'server-only'` の宣言義務**: `src/lib/supabase/server.ts` と `src/server/hono/**` の入口ファイル冒頭で必ず宣言し、`'use client'` への混入を build time でエラーにする
- **state-changing API は Origin / CSRF 検証必須**: `hono/csrf` または Origin ヘッダ検証を通過しない POST/PUT/DELETE は 403 を返す (詳細は [.claude/rules/api.md](./.claude/rules/api.md))
- **匿名コメント API はスパム対策 4 点セット必須**: rate limit + Cloudflare Turnstile + honeypot + URL 数 / 文字数上限 (詳細は [PLAN.md](./PLAN.md#コメント-api-のスパム--abuse-対策-phase-1-必須要件))
- **RLS 既定 ON**: 全テーブルで `enable row level security`。`disable row level security` を書かない
- **マイグレーション命名**: `supabase/migrations/NNNN_snake_case.sql` (例: `0003_handle_new_user.sql`)。連番で順序保証
- **環境変数**: 機密は `.env.local` (gitignore)、本番は Vercel env (production + preview)、CI は GitHub Actions secrets。**実メール・キーは絶対コミットしない**
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
| `pnpm db:seed` | 初期 admin 投入 (`tsx scripts/seed.ts`、`ADMIN_EMAIL` 必須) **※ Phase 1 で `scripts/seed.ts` を実装してから有効化** |

## TDD ワークフロー (red → green → refactor)

1. **red**: 期待する挙動の Vitest / Playwright を先に書き、`pnpm test` が失敗することを確認
2. **green**: 失敗テストを通す最小実装
3. **refactor**: 重複削減・命名改善。テストは緑のまま
4. 完了前に必ず `pnpm lint && pnpm typecheck && pnpm test && pnpm build` を通してから PR を開く (ブラウザ動作を伴う変更は `pnpm test:e2e` も追加)

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
- Claude Code hook (`.claude/settings.json`): `*.{ts,tsx,json,jsonc,css,md}` 編集時に `pnpm exec biome check --write` が自動適用される
- pre-commit (lefthook): `biome check --write` + `tsc --noEmit` + `vitest related` を parallel で実行 (md も biome 対象)
