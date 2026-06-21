---
paths:
  - "src/server/**"
  - "scripts/**"
  - "src/app/api/**"
---

# API レイヤ規約

サーバサイドコード (Hono + Next.js API route + 運用スクリプト) に適用される規約。

## ランタイム

- Hono ルートをマウントしている `src/app/api/[[...route]]/route.ts` では `export const runtime = 'nodejs'` を必ず宣言する。
- edge runtime には切り替えない。`@supabase/ssr` の cookie 操作 (`getAll` / `setAll`) は Node ランタイム前提で書かれており、edge ではセッション維持が崩れる。
- 別の API route を追加する場合も同様で、Supabase クライアントを触るものは Node ランタイムを明示する。

## Hono の構成

- ルートは `src/server/hono/routes/<name>.ts` に **新規ファイル** として追加する。
- バリデーションは `@hono/zod-validator` の `zValidator('json' | 'query' | 'param', schema)` を必須とする。zod スキーマは `src/lib/schemas.ts` に集約し、route 側からは import して使う (重複定義禁止)。
- `src/server/hono/app.ts` は `routes/*.ts` を一括登録する形 (バレル + 統一マウント) を保つ。**新規 route 追加 PR では `app.ts` を直接編集しない**。複数 PR が並列で衝突するため、`routes/` の追加だけで自動的に拾える仕組みを崩さない。
- middleware は `src/server/hono/middleware/` 配下。1 ファイル 1 ミドルウェアを基本とする。

```ts
// src/server/hono/routes/posts.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { listPostsQuery } from '@/lib/schemas'

const route = new Hono()
  .get('/', zValidator('query', listPostsQuery), async (c) => {
    const { status } = c.req.valid('query')
    // ...
  })

export default route
```

## Supabase クライアント

- `@supabase/ssr` の `createServerClient` を `src/lib/supabase/server.ts` 経由で利用する。route 内で `@supabase/supabase-js` の `createClient` を直接呼ばない。
- ブラウザ側 (`src/lib/supabase/client.ts`) は `createBrowserClient` を使う。サーバ専用クライアントを `'use client'` モジュールに import しない。

## 認可とサニタイズの責務 (Phase 1 アーキ判断)

- **認可は Postgres RLS が唯一の真実の源**。Hono ルートで認可判定を再実装しない。Hono は zod 検証 + セッション取り出し + 複合トランザクション + エラーマッピングだけを担う薄層。
- Hono は **必ず `createServerClient` (authenticated client) 経由** で Supabase を叩く。`SUPABASE_SECRET_KEY` (Supabase 新仕様の `sb_secret_***`、Legacy の service_role JWT を置き換える) を使う `createClient` の利用箇所は以下に限定する:
  - `scripts/seed.ts` (初期 admin upsert)
  - 招待時の `auth.admin.inviteUserByEmail` を呼ぶ admin 専用 route 1 箇所 (明示コメント `// secret-key: invite only` を付ける)
  - `auth.users` トリガー `handle_new_user` の内部 (Postgres 内、Node 側には漏れない)
- サニタイズは Hono ルートでは行わない。表示時に `src/lib/markdown.ts` の `renderMarkdownToSafeHtml()` を通す方式 (詳細は [components.md](./components.md))。

## サーバ専用モジュールの隔離

- `src/lib/supabase/server.ts` と `src/server/hono/**` の入口ファイル (`app.ts`, `routes/*.ts`, `middleware/*.ts`) は **冒頭に `import 'server-only'` を必ず宣言**する。`server-only` パッケージを devDep に追加し、`'use client'` 配下に import された瞬間 build エラーで落ちる構成にする。
- `scripts/*.ts` は **`server-only` を import しない**。`tsx` で直接実行される Node スクリプトでは `react-server` export condition が立たず、`server-only/index.js` が無条件に throw して実行自体が落ちる。代わりに冒頭で `process.env` / `process.exit` 等の Node 専用 API を参照することで Web ターゲットへの import 経路を物理的に閉じる方針に統一する。

## Origin / CSRF 検証

- state-changing route (POST / PUT / PATCH / DELETE) は `src/server/hono/middleware/csrf.ts` (`hono/csrf` または Origin ヘッダ検証) を **必ず通す**。
- 許可 Origin の決定方針:
  - **本番**: `NEXT_PUBLIC_SITE_URL` 起源のみ。
  - **preview**: Vercel preview の subdomain がランダム (`https://<project>-<hash>-<team>.vercel.app`) なので、**第一推奨は Vercel が自動注入する `VERCEL_URL` を `https://${process.env.VERCEL_URL}` の形で許可 Origin に加える**。これでデプロイごとの正しい preview Origin だけが通る。
  - 単純な `*.vercel.app` 末尾マッチは **採用しない**。他人のプロジェクトの preview からも CSRF が通ってしまい、ザル化する。やむを得ず wildcard を使う場合でも、必ず Vercel のプロジェクト名で前方一致を絞る (`<project>-*.vercel.app`)。
  - preview Origin の設定を忘れると preview デプロイで state-changing API 呼び出しが全部 403 になる。
- 例外を作る場合 (例: 外部 webhook) はルート単位で明示的に bypass コメント付きで除外する。デフォルト bypass は禁止。

## 匿名コメント API のスパム対策 (Phase 1 必須要件)

`POST /api/comments` 系の匿名 / 未認証 endpoint は以下 4 点セットを **同梱要件** とする。1 つでも欠ければ実装 PR をマージしない。

1. **rate limit**: 1 IP / 分 5 件、1 IP / 時 30 件 (sliding window)。`src/server/hono/middleware/rate-limit.ts` 経由。
2. **Cloudflare Turnstile invisible**: フロントでトークン取得 → サーバ側で `siteverify` 検証。失敗は 400。
3. **honeypot**: 隠しフィールド (`website` 等) を仕込み、値が入っていたら 200 を返して silent drop。
4. **入力上限**: 本文 2000 char (`comments.body` の DB check 制約と zod の `.max(2000)` で二重)、URL 出現数を zod `refine` で 2 個以下に制限。

## 機密の取り扱い

- `SUPABASE_SECRET_KEY` を参照してよいのは **上記「認可とサニタイズの責務」で列挙した経路のみ**。
- `src/lib/supabase/client.ts` および `'use client'` 配下のいかなるモジュールからも参照禁止。クライアントバンドルへの混入は重大インシデント扱い。
- `.env` / Vercel env / GitHub Actions secrets 以外の場所に書かない。コード上で直接文字列リテラルを書かない。

## エラーハンドリング

- Hono の `c.json({ error: '...' }, status)` で構造化レスポンスを返す。`throw new Error()` を握りつぶさない。
- バリデーションエラーは `@hono/zod-validator` が 400 + zod issue を自動で返すのに任せる。手で再実装しない。

### Supabase / Postgres エラー → HTTP ステータス変換

Supabase クライアントが返す `error.code` (PostgreSQL SQLSTATE) を Hono レイヤで HTTP に変換する。雑に 500 で返すと RLS 弾きやユニーク違反まで「サーバエラー」として扱われ、運用上のシグナルが潰れる。

| SQLSTATE | 意味 | HTTP |
|---|---|---|
| `42501` | insufficient_privilege (RLS 弾き / GRANT 不足) | **403** Forbidden |
| `23505` | unique_violation (slug 重複など) | **409** Conflict |
| `23503` | foreign_key_violation (`on delete restrict` で参照中の親を消そうとした等) | **409** Conflict |
| `23514` | check_violation (DB check 制約違反、zod で先に弾く想定) | **400** Bad Request |
| `PGRST116` | PostgREST: no rows found (`maybeSingle()` で null 期待時を除く) | **404** Not Found |
| その他 | 未分類 | **500** Internal Server Error |

ヘルパは `src/server/hono/lib/db-error.ts` (Phase 1 で実装) に集約し、各 route で `if (error) return c.json(mapDbError(error))` の形 (戻り値が body + status の組) に揃える。

## 運用スクリプト (`scripts/`)

- `tsx` で実行する Node スクリプト。`SUPABASE_SECRET_KEY` を使う処理はここに集約する (例: `scripts/seed.ts`)。
- 環境変数の必須チェックを冒頭で行い、欠落時は `process.exit(1)` する。
- import エイリアス (`@/`) は使ってよいが、`'use client'` モジュールを巻き込まないこと。
