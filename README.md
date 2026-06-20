# blog

ryu さん個人のブログサービス。

詳細仕様は [PLAN.md](./PLAN.md)、開発規約は [CLAUDE.md](./CLAUDE.md) を参照。

**現状**: Phase 0 (ハーネス・ガードレール整備) 完了直後。アプリ本体は Phase 1 で実装する。本 README の手順のうち `pnpm db:seed` と「初期 admin の登録」セクションは Phase 1 で `scripts/seed.ts` を実装してから有効化される。

## スタック

- Next.js 16 (App Router) / React 19 / TypeScript 6
- Hono 4 (API) ※ Phase 1 で導入
- Supabase (Postgres + Auth + RLS) ※ Phase 1 で導入、`@supabase/ssr` で SSR セッション
- Tailwind CSS v4
- pnpm 11 / Node 22 / Vercel
- Biome 2 (lint + format) / Vitest 4 / Playwright 1.61
- lefthook / GitHub Actions / Renovate

## 開発開始

```bash
git clone <repo>
cd blog

# pnpm をローカルに導入 (corepack 経由)
corepack enable
corepack prepare pnpm@latest --activate

# 依存インストール + git hook 自動登録 (package.json の prepare で lefthook install が走る)
pnpm install

# 環境変数 (Phase 1 で必要)
cp .env.local.example .env.local
# .env.local を編集し以下を埋める:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY  # サーバ専用、絶対クライアントに出さない
#   ADMIN_EMAIL                # 初期 admin の Google アカウント

# 開発サーバ起動
pnpm dev
```

## 主要コマンド

| Command | 用途 |
|---|---|
| `pnpm dev` | 開発サーバ |
| `pnpm build` | 本番ビルド |
| `pnpm start` | 本番モード起動 |
| `pnpm lint` | Biome 検査 |
| `pnpm format` | Biome 整形 |
| `pnpm typecheck` | TypeScript 型検査 |
| `pnpm test` | Vitest |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm db:seed` | 初期 admin 投入 (`ADMIN_EMAIL` 必須) ※ Phase 1 で有効化 |

## リポジトリ構成

現状 (Phase 0 完了直後):

- `src/app/` — Next.js App Router (現状はスケルトン `layout.tsx` / `page.tsx` のみ)
- `e2e/` — Playwright E2E (sample 1 件)
- `.claude/` — Claude Code ローカル規約 (`rules/`, `skills/`, `settings.json`)
- `.github/workflows/` — GitHub Actions (`ci.yml`, `claude-code-review.yml`, `claude.yml`)

Phase 1 で追加されるディレクトリ (詳細は [PLAN.md](./PLAN.md#phase-1-アプリ実装-tdd-で進める)):

- `src/app/api/[[...route]]/route.ts` — Hono への単一マウント点
- `src/server/hono/` — Hono アプリ本体 (`app.ts` + `middleware/` + `routes/`)
- `src/lib/` — Supabase クライアント、Markdown 処理、zod スキーマ
- `src/components/` — UI コンポーネント
- `src/middleware.ts` — Next root middleware (認証ガード)
- `scripts/` — 運用スクリプト (`seed.ts` など、サーバ専用)
- `supabase/migrations/` — SQL マイグレーション (`NNNN_snake.sql`)

## デプロイ (Vercel)

- Git Integration で `main` → production、PR → preview を自動デプロイ
- 環境変数は Vercel の Environment Variables で **production / preview / development** の 3 種それぞれに登録
- Google OAuth の redirect URL には以下を全部登録 (Supabase + Google Cloud Console 双方):
  - `https://<vercel-project>.vercel.app/auth/callback` (production)
  - preview URL パターン (例: `https://<vercel-project>-*.vercel.app/auth/callback`)
  - `http://localhost:3000/auth/callback` (ローカル開発)

## CI / branch protection / Renovate

- GitHub Actions の `build` / `e2e` の 2 job を branch protection の **Required status checks** に設定する (`Claude Code Review` / `claude` は required にしない)
- Renovate (Mend Renovate GitHub App) を導入し、minor/patch の自動 merge は CI green を条件に有効化する
- 詳細は [PLAN.md](./PLAN.md#phase-0-完了状況) の Phase 0 完了状況を参照

## 初期 admin の登録 (※ Phase 1 で有効化)

初期 admin の Google メールアドレスは環境変数 `ADMIN_EMAIL` から供給する。**コード/SQL にハードコードしない**。

- ローカル: `.env.local` の `ADMIN_EMAIL`
- 本番: Vercel の Environment Variables (production + preview)
- CI: GitHub Actions の secrets

Phase 1 で `scripts/seed.ts` を実装後、`pnpm db:seed` 実行で `editors` テーブルに admin 行が idempotent に投入される。

## ライセンス

Private (未公開)。
