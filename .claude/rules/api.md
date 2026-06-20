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

## 機密の取り扱い

- `SUPABASE_SERVICE_ROLE_KEY` を参照してよいのは **`scripts/`** と **`src/server/hono/`** のみ。
- `src/lib/supabase/client.ts` および `'use client'` 配下のいかなるモジュールからも参照禁止。クライアントバンドルへの混入は重大インシデント扱い。
- `.env.local` / Vercel env / GitHub Actions secrets 以外の場所に書かない。コード上で直接文字列リテラルを書かない。

## エラーハンドリング

- Hono の `c.json({ error: '...' }, status)` で構造化レスポンスを返す。`throw new Error()` を握りつぶさない。
- バリデーションエラーは `@hono/zod-validator` が 400 + zod issue を自動で返すのに任せる。手で再実装しない。

## 運用スクリプト (`scripts/`)

- `tsx` で実行する Node スクリプト。`SUPABASE_SERVICE_ROLE_KEY` を使う処理はここに集約する (例: `scripts/seed.ts`)。
- 環境変数の必須チェックを冒頭で行い、欠落時は `process.exit(1)` する。
- import エイリアス (`@/`) は使ってよいが、`'use client'` モジュールを巻き込まないこと。
