# ブログサービス構築プラン (Next.js + Hono + Supabase)

## Context

ryu さん個人のブログサービスを **新規 git リポジトリ** として `/Users/ryu/claude-workspace/dev/blog` 直下に構築する。現状このディレクトリは `PLAN.md` 一つだけが置かれた未 git 化の空ディレクトリで、submodule や既存ワークスペース構成は存在しない（クリーンな状態からの単一アプリ構成、アプリはルート直下）。

**いきなりアプリ実装には入らず、Claude Code でアプリ全体を構築するためのハーネス・ガードレールを先に整備** してからアプリ開発に入る、という順序で進める。

### 確定した要件・設計判断（ユーザー回答）

- **スタック**: Next.js (App Router) + TypeScript + Hono + Vercel + Supabase
- **認証認可**: Google ログイン。admin / editor のみログイン可。一般閲覧者はログインさせない
- **投稿**: admin / editor が Markdown で記事投稿
- **コメント**: 閲覧者（未ログイン）が匿名で投稿、**即時公開**（モデレーション削除のみ）
- **ロール**: DB ロールテーブルで管理。admin=ユーザー招待・ロール付与・全記事編集、editor=自分の記事のみ。初期 admin は seed SQL で投入
- **リポジトリ**: 新規 git リポジトリとしてこのディレクトリ直下に作成。submodule なし、アプリはルート直下
- **Linter/Formatter**: **Biome**（一本化・高速・設定レス、型検査は tsc で補完）
- **テスト**: **Vitest**（ユニット/統合）+ **Playwright**（E2E）
- **ガードレール**: Claude Code hooks（編集時 auto-format/lint）+ Git pre-commit（lefthook）+ GitHub Actions CI + Skills
- **依存管理**: **Renovate** で自動 merge（minor/patch 自動、major は手動）してバージョン追従

---

## Phase 0: ハーネス・ガードレール整備（最初に着手）

アプリ機能は作らず、開発基盤だけを先に固める。

### 0-1. リポジトリ初期化

- `git init` でこのディレクトリを新規 git リポジトリ化（main ブランチ）
- リモート作成は手動: ユーザーが GitHub 上で空リポジトリを作成し、`git remote add origin <url>` を後段で実行（CI / Renovate / branch protection の前提）
- 初期 `.DS_Store` は `.gitignore` で除外

### 0-2. ツールチェーン最小スキャフォールド（アプリ機能なし）

- `package.json`（Next.js 最新 / React / TypeScript、scripts: dev/build/start/lint/format/typecheck/test/test:e2e）
- `tsconfig.json`（strict 有効）、`next.config.ts`
- ルート直下の最小 App Router スケルトン（`src/app/layout.tsx` / `page.tsx` プレースホルダのみ）
- Tailwind CSS（最新, スタイリングのデフォルト）
- `.env.local.example`（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`）
- `.gitignore`（`node_modules/` `.next/` `.env.local` `coverage/` `playwright-report/` `test-results/`）

### 0-3. Lint / Format（Biome）

- `biome.json`: recommended ルール + formatter + import 整理。タブ/クォート等の基本方針を固定

### 0-4. テスト基盤（Vitest + Playwright）

- `vitest.config.ts` + React Testing Library + `vitest.setup.ts`、サンプル passing テスト1件
- `playwright.config.ts` + `e2e/` ディレクトリ + サンプル E2E 1件、ブラウザインストール
- TDD（red→green→refactor）を前提にした雛形

### 0-5. Claude Code ガードレール

- **`CLAUDE.md`（ブログ用に新規）**: アーキテクチャ方針（Hono は `app/api/[[...route]]`、Supabase は `@supabase/ssr`、RLS 既定 ON、Markdown は必ずサニタイズ、service role key をクライアントへ絶対出さない）、主要コマンド、TDD ワークフロー、命名規約、ディレクトリマップ、「完了前に biome + tsc + vitest を必ず通す」
- **`.claude/rules/`（path スコープ付き）**:
  - `testing.md`（`**/*.test.ts(x)`, `e2e/**`）— Vitest/Playwright 規約、AAA、過剰モック禁止
  - `api.md`（`src/server/**`）— Hono ルート規約、zod 検証必須、認証ミドルウェア
  - `supabase.md`（`supabase/**`）— マイグレーション命名、RLS 既定 ON、RLS 無効化禁止
  - `components.md`（`src/components/**`, `src/app/**/*.tsx`）— Server/Client component 使い分け、機密をクライアントに置かない
- **`.claude/settings.json` hooks**: PostToolUse（Edit|Write が `*.ts/*.tsx/*.json` にマッチ）→ 当該ファイルへ `biome check --write` を自動適用
- **`.claude/skills/`（高価値な定型手順のみ）**:
  - `new-migration` — タイムスタンプ付き supabase マイグレーションを RLS テンプレ込みで生成
  - `new-feature-tdd` — 失敗するテストを先に書く red-green-refactor 手順
  - `new-api-route` — Hono ルート + zod スキーマ + テストの追加手順

### 0-6. Git pre-commit（lefthook）

- `lefthook.yml`: pre-commit で staged ファイルへ `biome check` + `tsc --noEmit` + 関連 vitest を実行

### 0-7. CI（GitHub Actions）

- `.github/workflows/ci.yml`: install → biome check → tsc → vitest → build →（別ジョブ or 後続で）Playwright E2E。push / PR で実行。Renovate 自動 merge のゲートを兼ねる

### 0-8. Renovate（自動 merge でバージョン追従）

- `renovate.json`: `config:recommended` + `:dependencyDashboard`、minor/patch は `platformAutomerge: true`（CI green を必須）で自動 merge、major は手動 PR、devDeps グループ化、`lockFileMaintenance` 有効
- ユーザー側準備: Mend Renovate GitHub App 導入、GitHub の native auto-merge & branch protection（CI 必須）を有効化

---

## Phase 1: アプリ実装（ガードレール整備後、TDD で進める）

### アーキテクチャ概要

```
公開ページ (Server Component → Supabase 直接 SELECT, Hono を経由しない)
  /                 記事一覧（published のみ）
  /posts/[slug]     記事詳細 + コメント一覧 + 匿名コメントフォーム
認証 (Supabase Auth, Google OAuth)
  /login            Google ログイン
  /auth/callback    OAuth コールバック（exchangeCodeForSession, PKCE）
管理画面 (middleware でロール検証, admin/editor のみ)
  /admin /admin/posts/new /admin/posts/[id]/edit /admin/comments /admin/users
API (Hono, app/api/[[...route]]/route.ts に hono/vercel でマウント)
  POST /api/comments(公開) / 記事CRUD・コメント削除・ユーザー招待(保護)
```

### データモデル（`supabase/migrations/0001_init.sql`）

- **editors**: `id`, `user_id uuid unique → auth.users`(初回ログインまで null), `email unique`, `role ('admin'|'editor')`, `display_name`, `created_at`
- **posts**: `id`, `author_id → editors`, `title`, `slug unique`, `content_md`, `status ('draft'|'published')`, `published_at`, `created_at`, `updated_at`
- **comments**: `id`, `post_id → posts on delete cascade`, `author_name`, `body`, `created_at`

#### ログイン制限の実装（肝）

Supabase Auth は任意の Google アカウントでサインインできるため、`auth.users` INSERT トリガー `handle_new_user()` で許可リスト外を拒否:
- email で `editors` を検索 → 一致すれば `user_id` を紐付け、一致しなければ `raise exception` でサインアップ中断
- 初期 admin は環境変数 `ADMIN_EMAIL` を読む Node 製 seed スクリプト (`scripts/seed.ts`) で `editors` に idempotent upsert する。**SQL にもコードにも実メールはハードコードしない**。ローカルは `.env.local`、本番は Vercel env vars、CI は GitHub Actions secrets で `ADMIN_EMAIL` を供給

#### RLS ポリシー

- `posts`: 公開 SELECT は `published` のみ／admin は全件・editor は自分の記事のみ編集
- `comments`: SELECT・INSERT 公開（匿名）、DELETE は editor/admin のみ。サーバー側で zod 検証 + 長さ制限（最低限のスパム耐性）
- `editors`: 管理は admin のみ、editor は自分の行のみ参照

### Hono API（`src/server/hono/`）

`app.ts`（ルート）+ `middleware.ts`（Cookie の Supabase セッション検証 + ロード）。`@hono/zod-validator` + zod で入力検証。著者/admin 権限チェック。

### フロント実装（TDD）

- `src/lib/supabase/{server,client,middleware}.ts`（`@supabase/ssr`）、`src/lib/markdown.ts`（remark-gfm + rehype-sanitize で XSS 対策）、`src/lib/schemas.ts`（zod）
- `src/components/`（`MarkdownEditor` = textarea + react-markdown プレビュー、`CommentForm`、`CommentList`）
- `middleware.ts`（`/admin`・保護 API のロールガード）

### ユーザー側の事前準備（コード外）

- Supabase プロジェクト作成（URL / anon key / service role key 取得）
- Supabase Auth で Google プロバイダ有効化（Google Cloud OAuth クライアント登録、リダイレクト URL 設定）
- 初期 admin メール (`ADMIN_EMAIL`) をローカル `.env.local`、本番は Vercel env vars、CI は GitHub Actions secrets に登録（SQL/コードにハードコードしない）

---

## 検証方法

### Phase 0
- `npm run lint`（biome）/ `npm run typecheck`（tsc）/ `npm run test`（vitest サンプル green）/ `npm run test:e2e`（playwright サンプル green）/ `npm run build` が通る
- ファイルを編集 → Claude Code hook で自動 format がかかる
- ダミー commit で lefthook が発火する
- CI（GitHub Actions）が green、Renovate の dependency dashboard が出る

### Phase 1
- **ログイン制限**: 許可外 Google アカウント → 拒否、seed admin → `/admin` 可
- **記事投稿**: Markdown 記事を作成・公開 → 一覧/詳細に表示、draft は公開ページに出ない
- **権限**: editor は他人の記事を編集不可、admin は全記事編集・ユーザー招待可
- **コメント**: 未ログインで匿名投稿 → 即時表示、editor/admin が削除可
- **サニタイズ**: 記事/コメントの `<script>` 等が無効化される（XSS テスト）
- 認証・投稿・コメントの重要フローを Playwright E2E でカバー
