# ブログサービス構築プラン (Next.js + Hono + Supabase)

## Context

ryu さん個人のブログサービスを Next.js + Hono + Supabase の単一アプリとして構築する。submodule 無し、アプリはリポジトリルート直下。

**Phase 0 (ハーネス・ガードレール整備) はコード/設定面でほぼ完了**。残タスクは [Phase 0 完了状況](#phase-0-完了状況) を参照。
**Phase 1 (アプリ実装) 着手前に [アーキテクチャ判断](#アーキテクチャ判断-phase-1-着手前に固める) と [実装スコープ (MVP / 将来)](#実装スコープ-mvp--将来) を必ず読むこと。** Hono / RLS / サニタイズ / スパム対策の責務分担をここで固めてから実装に入る。

### 確定した要件・設計判断（ユーザー回答）

- **スタック**: Next.js (App Router) + TypeScript + Hono + Vercel + Supabase
- **認証認可**: Google ログイン。admin / editor のみログイン可。一般閲覧者はログインさせない
- **投稿**: admin / editor が Markdown で記事投稿
- **コメント**: 閲覧者（未ログイン）が匿名で投稿、**即時公開**（モデレーション削除のみ）
- **ロール**: DB ロールテーブルで管理。admin=ユーザー招待・ロール付与・全記事編集、editor=自分の記事のみ。初期 admin は seed スクリプトで投入
- **リポジトリ**: 新規 git リポジトリとしてこのディレクトリ直下に作成。submodule なし、アプリはルート直下
- **Linter/Formatter**: **Biome**（一本化・高速・設定レス、型検査は tsc で補完）
- **テスト**: **Vitest**（ユニット/統合）+ **Playwright**（E2E）
- **ガードレール**: Claude Code hooks（編集時 auto-format/lint）+ Git pre-commit（lefthook）+ GitHub Actions CI + Skills
- **依存管理**: **Renovate** で自動 merge（minor/patch 自動、major は手動）してバージョン追従

---

## Phase 0: ハーネス・ガードレール整備

### Phase 0 完了状況

コード/設定で完結する項目:

- [x] **0-1** リポジトリ初期化 (`git init`, `.gitignore`, `.gitattributes`)
- [x] **0-2** ツールチェーンスキャフォールド (Next.js 16 / React 19 / TypeScript 6 / Tailwind v4 / pnpm 11 / Node 22 / `.env.local.example`)
- [x] **0-3** Lint / Format (Biome 2 + `biome.json`)
- [x] **0-4** テスト基盤 (Vitest 4 + Playwright 1.61、サンプル各 1 件)
- [x] **0-5** Claude Code ガードレール (`CLAUDE.md` / `.claude/rules/` / `.claude/skills/` / `.claude/settings.json` hook)
- [x] **0-6** Git pre-commit (`lefthook.yml`: biome / typecheck / vitest related, parallel)
- [x] **0-7** CI (`.github/workflows/ci.yml`: build (lint/typecheck/test/build) + e2e、Renovate ゲート兼用)
- [x] **0-8** Renovate (`renovate.json`: minor/patch automerge + lockFileMaintenance)
- [x] **0-9** セキュリティヘッダ最小セット (`next.config.ts`: `X-Content-Type-Options` / `Referrer-Policy` / `Permissions-Policy` / `X-Frame-Options`)
- [x] **0-10** ドキュメント (`PLAN.md` / `CLAUDE.md` / `README.md`) と [アーキテクチャ判断](#アーキテクチャ判断-phase-1-着手前に固める) の明文化

ユーザー手動作業 (コード外):

- [ ] GitHub 上で空リポジトリを作成し `git remote add origin <url>` (CI / Renovate / branch protection の前提)
- [ ] Mend Renovate GitHub App 導入
- [ ] GitHub native auto-merge 有効化、branch protection で Required status checks に `build` / `e2e` を設定 (Claude Code Review / Claude は required にしない)
- [ ] Supabase プロジェクト作成、Google OAuth プロバイダ有効化、redirect URL 登録
- [ ] Cloudflare Turnstile site key / secret 発行 (Phase 1 コメント実装の手前まで)
- [ ] Vercel Git Integration 設定、env (production + preview + development) 登録

### 0-1〜0-8 の詳細

#### 0-1. リポジトリ初期化

- `git init` でこのディレクトリを新規 git リポジトリ化 (main ブランチ)
- リモート作成は手動: ユーザーが GitHub 上で空リポジトリを作成し、`git remote add origin <url>` を後段で実行 (CI / Renovate / branch protection の前提)
- 初期 `.DS_Store` は `.gitignore` で除外

#### 0-2. ツールチェーン最小スキャフォールド (アプリ機能なし)

- `package.json` (Next.js 最新 / React / TypeScript、scripts: dev/build/start/lint/format/typecheck/test/test:e2e/prepare)
- `tsconfig.json` (strict 有効)、`next.config.ts`
- ルート直下の最小 App Router スケルトン (`src/app/layout.tsx` / `page.tsx` プレースホルダのみ)
- Tailwind CSS v4 (PostCSS プラグイン経由)
- `.env.local.example` (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_EMAIL`)
- `.gitignore` (`node_modules/` `.next/` `.env.local` `coverage/` `playwright-report/` `test-results/`)

#### 0-3. Lint / Format (Biome)

- `biome.json`: recommended ルール + formatter + import 整理。タブ/クォート等の基本方針を固定

#### 0-4. テスト基盤 (Vitest + Playwright)

- `vitest.config.ts` + React Testing Library + `vitest.setup.ts`、サンプル passing テスト 1 件
- `playwright.config.ts` (`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`) + `e2e/` ディレクトリ + サンプル E2E 1 件
- TDD (red→green→refactor) を前提にした雛形

#### 0-5. Claude Code ガードレール

- **`CLAUDE.md`**: アーキテクチャ方針 (本書 [アーキテクチャ判断](#アーキテクチャ判断-phase-1-着手前に固める) へのリンクを含む)、主要コマンド、TDD ワークフロー、命名規約、ディレクトリマップ、「完了前に biome + tsc + vitest を必ず通す」
- **`.claude/rules/`** (path スコープ付き):
  - `testing.md` (`**/*.test.ts(x)`, `e2e/**`) — Vitest/Playwright 規約、AAA、過剰モック禁止
  - `api.md` (`src/server/**`, `src/app/api/**`, `scripts/**`) — Hono ルート規約、zod 検証、Origin/CSRF、`server-only` 義務
  - `supabase.md` (`supabase/**`) — マイグレーション命名、RLS 既定 ON、SECURITY DEFINER パターン
  - `components.md` (`src/components/**`, `src/app/**/*.tsx`) — Server/Client component 使い分け、サニタイズ責務、機密の取り扱い
- **`.claude/settings.json` hooks**: PostToolUse (Edit|Write|MultiEdit が `*.ts/*.tsx/*.json/*.jsonc/*.css/*.md` にマッチ) → 当該ファイルへ `biome check --write` を自動適用
- **`.claude/skills/`** (高価値な定型手順のみ):
  - `new-migration` — Supabase マイグレーションを RLS テンプレ込みで生成 (auth.users 用 / application 用テンプレ分離)
  - `new-feature-tdd` — 失敗するテストを先に書く red-green-refactor 手順
  - `new-api-route` — Hono ルート + zod スキーマ + テスト + middleware の追加手順

#### 0-6. Git pre-commit (lefthook)

- `lefthook.yml`: pre-commit で staged ファイルへ `biome check --write` + `tsc --noEmit` + `vitest related` を実行
- `package.json` の `prepare` script に `lefthook install || true` を入れ、fresh clone / worktree で hook が無言スキップされない構成

#### 0-7. CI (GitHub Actions)

- `.github/workflows/ci.yml`: `pnpm install --frozen-lockfile` → biome ci → tsc → vitest → build → (別 job で) Playwright E2E
- e2e job は `actions/upload-artifact@v4` で `playwright-report/` と `test-results/` を保管 (`if: always()`)
- push / PR で実行。Renovate auto-merge のゲートを兼ねる

#### 0-8. Renovate (自動 merge でバージョン追従)

- `renovate.json`: `config:recommended` + `:dependencyDashboard`、minor/patch は `platformAutomerge: true` (CI green を必須) で自動 merge、major は手動 PR、devDeps グループ化、`lockFileMaintenance` 有効
- ユーザー側準備: Mend Renovate GitHub App 導入、GitHub の native auto-merge & branch protection (CI 必須) を有効化

---

## Phase 1: アプリ実装 (TDD で進める)

### アーキテクチャ判断 (Phase 1 着手前に固める)

#### Hono を採用する理由

Next.js Route Handler または Server Action でも要件は満たせるが、以下の理由で Hono を 1 層挟む:

- **将来 Cloudflare Workers / Deno / Bun 等へ切り出せる**: Hono は Web 標準 Fetch ベースで、Next から剥がした時の移植コストが低い
- **`hono/client` で RPC 風の型安全 API クライアント**: フロント / route 間の型同期コストを下げる (`'use client'` から呼ぶコメントフォーム等で有利)
- **middleware composition**: `hono/csrf` / `hono/cors` / rate limiter / セッション注入を合成して使える
- **将来 RSS / OG image / 外部公開 API などをぶら下げる時の入口** が固まる

撤去判断 (シンプル化したい場合) は、CLAUDE.md / `.claude/rules/api.md` / `.claude/skills/new-api-route` を同 PR でセットで畳む必要がある。

#### 認可レイヤ: RLS が唯一の真実の源

- **認可ロジックは Postgres RLS のポリシーに集約**する。Hono / Next middleware で同じ判定を二重実装しない
- Hono は **薄いレイヤ** に徹する:
  - cookie からの Supabase セッション取り出し (`@supabase/ssr` の `createServerClient`)
  - `zValidator` による入力検証
  - 複合トランザクション / 外部副作用 (招待メール送信、Turnstile siteverify 等)
  - エラー → HTTP ステータスマッピング
- Hono は **必ず `createServerClient` の authenticated client 経由で Supabase を叩く**。`SUPABASE_SERVICE_ROLE_KEY` を使う `createClient` は以下に限定:
  - `scripts/seed.ts` (初期 admin upsert)
  - `auth.users` トリガー `handle_new_user` の内部 (Postgres 内、Node 側には漏れない)
  - 招待時の `auth.admin.inviteUserByEmail` (Hono の admin 専用 route 1 箇所、明示コメント付き)
- Next middleware (`src/middleware.ts`) は `/admin` 配下に対する **ログイン要否 check のみ** (未ログインなら `/login` リダイレクト)。詳細な可否判定は RLS に委譲する

#### サニタイズ責務: 表示時単一入口

- 投稿は `posts.content_md` に **生 Markdown のまま保存** する (保存時にサニタイズしない)
- 表示時に必ず `src/lib/markdown.ts` の `renderMarkdownToSafeHtml(md: string): string` ヘルパを通す:
  - `remark-parse` → `remark-gfm` → `remark-rehype` (`allowDangerousHtml: false`) → `rehype-pretty-code` → `rehype-sanitize` → `rehype-stringify`
  - `rehype-sanitize` の schema は `defaultSchema` ベース、`href` / `img.src` の protocol allowlist を `http` / `https` / `mailto` に限定 (詳細は [.claude/rules/components.md](./.claude/rules/components.md))
- **コメント本文は plain text + 改行のみ**。Markdown レンダリングしない (XSS 表面積最小化)
- `dangerouslySetInnerHTML` で生 HTML を直接埋めない。`renderMarkdownToSafeHtml` の戻り値のみ許可

#### サーバ専用モジュールの隔離

- `src/lib/supabase/server.ts` / `src/server/hono/**` 冒頭で `import 'server-only'` を必ず宣言
- `server-only` パッケージを devDep に追加し、`'use client'` への混入を build time でエラーにする
- `SUPABASE_SERVICE_ROLE_KEY` への参照は文字列リテラル grep で検出可能な単一経路に揃える

### データモデル (`supabase/migrations/0001_init.sql` 〜)

下記は全テーブルの最終形 (Phase 1 完了時)。実 migration は [.claude/skills/new-migration](./.claude/skills/new-migration/SKILL.md) の推奨に従い `0001_init.sql` (editors + `current_editor_role()`) / `0002_posts.sql` / `0003_comments.sql` / `0004_handle_new_user.sql` に **分割** する。

#### editors

- `id uuid pk default gen_random_uuid()`
- `user_id uuid unique references auth.users(id) on delete cascade` (初回ログインまで null)
- `email text not null unique`
- `email_normalized text generated always as (lower(email)) stored unique`
  - `handle_new_user` は `e.email_normalized = lower(new.email)` で照合 (Gmail 等の大小違いで初期 admin ロックアウトを防ぐ)
- `role text not null check (role in ('admin','editor'))`
- `display_name text not null`
- `created_at timestamptz not null default now()`

#### posts

- `id uuid pk default gen_random_uuid()`
- `author_id uuid not null references editors(id) on delete restrict`
  - editor 退会時の所有権移管を強制する意図を明示 (cascade で記事消滅 / set null で著者不明、どちらも事故)
- `title text not null check (char_length(title) between 1 and 200)`
- `slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$' and char_length(slug) <= 100)`
  - slug は title から slugify 自動生成 + 編集者が上書き可。Phase 1 では **immutable** (update 経路から外す)
  - unique violation は Hono で 409 に変換 (zod パターンは `src/lib/schemas.ts` に集約)
- `content_md text not null`
- `status text not null default 'draft' check (status in ('draft','published'))`
- `published_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` + `moddatetime` トリガーで自動更新 (アプリ層では明示更新しない、両用禁止)

#### comments

- `id uuid pk default gen_random_uuid()`
- `post_id uuid not null references posts(id) on delete cascade`
- `author_name text not null check (char_length(author_name) between 1 and 50)`
- `body text not null check (char_length(body) between 1 and 2000)`
- `created_at timestamptz not null default now()`
- IP / UA カラムは Phase 1 では追加しない (プライバシーポリシー + 保持期間整備とセットで段階導入)

### 認証フロー: 許可リスト方式

Supabase Auth は任意の Google アカウントでサインインできるため、`auth.users` INSERT トリガー `handle_new_user()` で許可リスト外を拒否:

1. `lower(new.email)` で `editors.email_normalized` を検索
2. ヒットすれば `editors.user_id` を `new.id` で更新 (紐付け)
3. ヒットしなければ `raise exception '<msg>'` で INSERT 中断 → Supabase 側はサインアップエラーを返す

実装上の注意:

- 関数は `security definer set search_path = public, pg_temp`
- `revoke all on function public.handle_new_user() from public`
- `grant execute on function public.handle_new_user() to supabase_auth_admin` (auth.users トリガーは `supabase_auth_admin` が実行するため、`authenticated` への grant では permission denied になる)
- PKCE / state / verifier の取り扱いは `@supabase/ssr` のデフォルト (HTTP-only cookie に格納、SDK が verify) に任せる
- `/auth/callback` で `exchangeCodeForSession` 失敗時は「許可リスト外の可能性があります。管理者に連絡してください」のフォールバック表示

初期 admin は `ADMIN_EMAIL` 環境変数を読む Node 製 seed スクリプト (`scripts/seed.ts`) で `editors` に idempotent upsert。**SQL / コードに実メールをハードコードしない**:

- ローカル: `.env.local` の `ADMIN_EMAIL`
- 本番: Vercel Environment Variables
- CI: GitHub Actions secrets

### RLS ポリシー

`posts`:

- 公開 SELECT: `using (status = 'published')`
- admin INSERT/UPDATE/DELETE: `using (public.current_editor_role() = 'admin')`
- editor INSERT/UPDATE/DELETE: `using (author_id = (select id from editors where user_id = auth.uid()))` (自分の記事のみ)

`comments`:

- SELECT 公開 / INSERT 公開 (匿名)
- DELETE: `using (public.current_editor_role() in ('admin','editor'))`
- サーバ側 (Hono) で zod 検証 + 後述のスパム対策を必須化

`editors`:

- SELECT: `using (user_id = auth.uid() or public.current_editor_role() = 'admin')` (自分の行のみ + admin は全件)
- INSERT/UPDATE/DELETE: admin のみ

`current_editor_role()` は `editors` を RLS から再帰参照させない SECURITY DEFINER 関数 (詳細は [.claude/rules/supabase.md](./.claude/rules/supabase.md))。

### Hono API (`src/server/hono/`)

- `src/server/hono/app.ts`: `routes/*.ts` をバレル自動登録 (新規 route 追加時に `app.ts` を編集しない)
- `src/server/hono/middleware/`:
  - `session.ts`: cookie から Supabase session を取り出し、`c.var.user` / `c.var.editor` (role 付き) に流し込む
  - `csrf.ts`: state-changing route で `hono/csrf` または Origin ヘッダ検証を必ず通す。許可 Origin は本番が `NEXT_PUBLIC_SITE_URL`、preview は `https://${process.env.VERCEL_URL}` の組み合わせ (preview の取り扱い詳細は [.claude/rules/api.md](./.claude/rules/api.md) の「Origin / CSRF 検証」参照)
  - `rate-limit.ts`: sliding window 実装 (Supabase テーブル `rate_limits` または KV ベース、Phase 1 で確定)
- `src/server/hono/routes/`:
  - `comments.ts`: POST 公開 (スパム対策 4 点セット必須、詳細は下記)、DELETE editor/admin
  - `posts.ts`: 記事 CRUD (admin/editor)
  - `editors.ts`: ユーザー招待 (admin)

### コメント API のスパム / abuse 対策 (Phase 1 必須要件)

匿名・即時公開は SEO スパムボットの直撃ターゲットになるため、以下を **Phase 1 のコメント実装 PR の同梱要件** とする:

- **rate limit**: 1 IP / 分 5 件、1 IP / 時 30 件 (sliding window)
- **Cloudflare Turnstile** invisible: フロントでトークン取得 → Hono 側で `siteverify` 検証を必須化
- **honeypot**: フォームに隠しフィールド (`website` 等) を仕込み、値が入っていたら 200 を返して silent drop
- **本文上限**: 2000 char (`comments.body` の check 制約と zod スキーマで二重)
- **URL 数上限**: 本文中の URL 出現を 2 個以下 (zod の `refine` + サーバ側)
- **Origin / CSRF**: `hono/csrf` ミドルウェアまたは Origin ヘッダ検証を通過しない POST は 403
- **IP / UA 記録**: 当面追加しない。導入時はプライバシーポリシー + 保持期間 (90 日) + RLS で開発者本人のみ参照可、を同 PR で整備

### Markdown / コードハイライト

- `src/lib/markdown.ts` は unified pipeline + `rehype-pretty-code` (shiki) でコードブロックハイライト
- XSS ゴールデンテスト (`<script>`, `javascript:` href, `<img onerror>`, `<svg onload>`, `data:` URI) を `src/lib/markdown.test.ts` に同梱

### フロント実装 (TDD)

- `src/lib/supabase/{server,client,middleware}.ts` (`@supabase/ssr`)
- `src/lib/markdown.ts` (unified + rehype-pretty-code)
- `src/lib/schemas.ts` (zod、URL 数 `refine` 含む)
- `src/components/`:
  - `MarkdownEditor`: textarea + プレビュー
  - `CommentForm`: Turnstile widget + honeypot + 文字数カウンタ
  - `CommentList`: 一覧表示 (Markdown 描画なし)
  - `PostBody`: `renderMarkdownToSafeHtml` の結果のみを `dangerouslySetInnerHTML` で描画
- `src/middleware.ts` (`/admin` 配下のロールガード)

### 実装スコープ (MVP / 将来)

#### MVP (Phase 1 で必ず作る)

- 認証 (Google OAuth + 許可リスト)、記事 CRUD、コメント (匿名 + スパム対策)
- 記事の Markdown 描画 + コードハイライト (rehype-pretty-code + shiki)
- `app/sitemap.ts` で sitemap.xml、`app/robots.ts` で robots.txt
- `generateMetadata` で OGP (og:title / og:description / og:image)
- 動的 OG image: `app/og/route.ts` を **edge runtime** で別マウント (`@supabase/ssr` の nodejs runtime route とは分離)
- Supabase Storage の `post-images` bucket + RLS + `next.config.ts` の `images.remotePatterns` に Supabase ドメインを追加
- Vercel preview / production deploy (Git Integration)

#### 将来 (Phase 1 後半 〜 Phase 2)

- RSS (`app/feed.xml/route.ts`)
- 検索 (Postgres `pg_trgm` か Algolia/Meilisearch、リード量と費用次第)
- analytics (Vercel Web Analytics か Plausible)
- ロギング (Sentry / Logflare は取りこぼしが出てから段階導入)
- migration の本番自動 apply (Supabase CLI + GitHub Actions OIDC、当面は手動 or ダッシュボード)
- CSP / HSTS の Next 公式 nonce ベース middleware パターン

### ロギング / 監視

- 構造化ログ: Hono / Server Action / Server Component で `console.error` する時は `JSON.stringify({ level, msg, route, request_id, user_id, error })` の 1 行形式
- Vercel Runtime Logs: production / preview の `error` ログをリリース直後 + 月 1 で目視
- Supabase Logs: `handle_new_user` の raise exception 件数を監視 (リリース直後 + 月 1)
- Sentry / Logflare は **取りこぼしが出てから** 段階導入。Phase 1 必須要件ではない

### セキュリティヘッダ (`next.config.ts`)

Phase 0 で投入する 4 ヘッダ (二重防御の最低限):

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: DENY`
  - 将来 iframe 埋め込み (Storybook 公開 / OG image preview / 外部サイト埋め込み等) の要件が出たら `SAMEORIGIN` への緩和か CSP の `frame-ancestors` ディレクティブへの一本化を検討する

CSP / HSTS は Phase 1 の Markdown 描画 + 本番ドメイン確定とセットで、Next 公式の nonce ベース middleware パターンで導入。

### E2E / 認証フィクスチャ

- 実 Google OAuth を E2E で踏まない (CI で不安定 + 外部 IdP 依存)
- Supabase に test user (admin / editor) を seed し、`storageState` を `e2e/fixtures/auth.ts` の `test.beforeAll` 経由で生成して再利用
- 詳細は [.claude/rules/testing.md](./.claude/rules/testing.md)

### ユーザー側の事前準備 (コード外)

- Supabase プロジェクト作成 (URL / anon key / service role key 取得)
- Supabase Auth で Google プロバイダ有効化 (Google Cloud OAuth クライアント登録、redirect URL に `https://<vercel-project>.vercel.app/auth/callback` + preview URL パターン + `http://localhost:3000/auth/callback` を全部登録)
- 初期 admin メール (`ADMIN_EMAIL`) を `.env.local` / Vercel env (production + preview) / GitHub Actions secrets に登録
- Cloudflare アカウント + Turnstile site key / secret key の発行 (Phase 1 コメント実装の手前まで)
- Vercel Git Integration 設定 (main → production / PR → preview)、env は production / preview / development の 3 種それぞれ登録
- branch protection: Required status checks を `build` / `e2e` の 2 つに設定 (Claude Code Review / Claude は required にしない)

---

## 検証方法

### Phase 0

- `pnpm lint` (biome) / `pnpm typecheck` (tsc) / `pnpm test` (vitest sample green) / `pnpm test:e2e` (playwright sample green) / `pnpm build` が通る
- ファイルを編集 → Claude Code hook で自動 format がかかる
- ダミー commit で lefthook が発火する
- CI (GitHub Actions) が green、Renovate の dependency dashboard が出る

### Phase 1

- **ログイン制限**: 許可外 Google アカウント → 拒否、seed admin → `/admin` 可
- **記事投稿**: Markdown 記事を作成・公開 → 一覧 / 詳細に表示、draft は公開ページに出ない
- **権限**: editor は他人の記事を編集不可、admin は全記事編集・ユーザー招待可
- **コメント**: 未ログインで匿名投稿 → 即時表示、editor/admin が削除可、Turnstile / honeypot / rate limit が機能
- **サニタイズ**: 記事の `<script>` 等が無効化される (XSS ゴールデンテスト green)。コメントは plain text 表示 (Markdown 描画されない)
- **OGP**: `/posts/<slug>` の OG image / OGP メタが正しく出力される
- 認証・投稿・コメントの重要フローを Playwright E2E でカバー
