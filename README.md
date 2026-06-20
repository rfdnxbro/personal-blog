# blog

ryu さん個人のブログサービス。

詳細仕様は [PLAN.md](./PLAN.md)、開発規約は [CLAUDE.md](./CLAUDE.md) を参照。

> 本 README に記載の `pnpm` コマンドおよびディレクトリは scaffold 完了 (PR #1 merge) 後に有効になる。

## スタック

- Next.js 16 (App Router) / React 19 / TypeScript 6
- Hono 4 (API)
- Supabase (Postgres + Auth + RLS)、`@supabase/ssr` で SSR セッション
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

pnpm install

# 環境変数
cp .env.local.example .env.local
# .env.local を編集し以下を埋める:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY  # サーバ専用、絶対クライアントに出さない
#   ADMIN_EMAIL                # 初期 admin の Google アカウント

# git hook を有効化
pnpm exec lefthook install

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
| `pnpm db:seed` | 初期 admin 投入 (`ADMIN_EMAIL` 必須) |

## リポジトリ構成

- `src/app/` — Next.js App Router
- `src/server/hono/` — Hono API レイヤ
- `src/lib/` — Supabase クライアント、Markdown 処理、zod スキーマ
- `src/components/` — UI コンポーネント
- `src/middleware.ts` — Next root middleware (認証ガード)
- `scripts/` — 運用スクリプト
- `supabase/migrations/` — SQL マイグレーション
- `e2e/` — Playwright E2E
- `.claude/` — Claude Code ローカル規約

## 初期 admin の登録

初期 admin の Google メールアドレスは環境変数 `ADMIN_EMAIL` から供給する。**コード/SQL にハードコードしない**。

- ローカル: `.env.local` の `ADMIN_EMAIL`
- 本番: Vercel の Environment Variables
- CI: GitHub Actions の secrets

`pnpm db:seed` 実行で `editors` テーブルに admin 行が idempotent に投入される。

## ライセンス

Private (未公開)。
