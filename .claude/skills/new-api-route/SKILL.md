---
name: new-api-route
description: Hono の新しい API route を `src/server/hono/routes/<name>.ts` に追加する手順。`@hono/zod-validator` でリクエストバリデーションを掛け、Vitest で route 単体テストをセットで書く。並列 PR 衝突を避けるため `app.ts` は直接編集しない。
---

# new-api-route スキル

新規 API route を Hono に追加する。route 追加 / バリデーション / テストの 3 点セットで揃える。

## 三点セット

1. **route 本体**: `src/server/hono/routes/<name>.ts` を新規作成
2. **バリデーション**: `@hono/zod-validator` で `json` / `query` / `param` をスキーマ検証
3. **テスト**: `src/server/hono/routes/__tests__/<name>.test.ts` で `app.request()` 経由の route 単体テスト

## 手順

### 1. zod スキーマを `src/lib/schemas.ts` に追加

リクエスト / レスポンス共通で使う zod スキーマは `src/lib/schemas.ts` に集約する。route ファイル内で重複定義しない。

```ts
// src/lib/schemas.ts
import { z } from 'zod'

export const createPostBody = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  status: z.enum(['draft', 'published']).default('draft'),
})
export type CreatePostBody = z.infer<typeof createPostBody>
```

### 2. route ファイルを新規作成

`src/server/hono/routes/<name>.ts` に新しい Hono ルートを作る。**既存の `app.ts` は触らない** (バレル経由で自動登録される前提)。

```ts
// src/server/hono/routes/posts.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createPostBody } from '@/lib/schemas'
import { createServerClient } from '@/lib/supabase/server'

const route = new Hono()
  .post('/', zValidator('json', createPostBody), async (c) => {
    const body = c.req.valid('json')
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('posts')
      .insert(body)
      .select()
      .single()
    if (error) return c.json({ error: error.message }, 500)
    return c.json(data, 201)
  })

export default route
```

ポイント:

- `zValidator` を使えば 400 + zod issue を自動で返してくれる。自前で `try / catch` しない。
- Supabase クライアントは `src/lib/supabase/server.ts` を経由する。`@supabase/supabase-js` を直接 import しない。
- レスポンスは必ず `c.json()` で構造化して返す。

### 3. route 単体テストを書く

`src/server/hono/routes/__tests__/<name>.test.ts` を作り、`app.request()` で HTTP を直接叩く形でテストする。

```ts
// src/server/hono/routes/__tests__/posts.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import posts from '../posts'

describe('POST /posts', () => {
  it('returns 400 when title is empty', async () => {
    // Arrange
    const app = new Hono().route('/posts', posts)

    // Act
    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '', body: 'hello' }),
    })

    // Assert
    expect(res.status).toBe(400)
  })
})
```

- 外部 I/O (Supabase) は依存注入またはファクトリ経由で stub を差し込む。`@supabase/ssr` をモジュールモックしない。
- 詳細は `.claude/rules/testing.md` を参照。

### 4. ランタイム宣言を確認

`src/app/api/[[...route]]/route.ts` で `export const runtime = 'nodejs'` が宣言されていることを確認する。edge ランタイムに切り替えない。

### 5. 仕上げ

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

をすべて緑で通してから PR を開く。

## チェックリスト

- [ ] route を `src/server/hono/routes/<name>.ts` に新規作成した
- [ ] `app.ts` を編集していない (並列 PR の衝突回避)
- [ ] `@hono/zod-validator` で `json` / `query` / `param` をバリデートしている
- [ ] zod スキーマは `src/lib/schemas.ts` に置き、route から import している
- [ ] Supabase クライアントは `src/lib/supabase/server.ts` 経由
- [ ] `SUPABASE_SERVICE_ROLE_KEY` を `'use client'` 配下に漏らしていない
- [ ] route 単体テストを `app.request()` で書いた
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` が緑
