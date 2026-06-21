---
name: new-api-route
description: Hono の新しい API route を `src/server/hono/routes/<name>.ts` に追加する手順。`@hono/zod-validator` でリクエストバリデーションを掛け、Vitest で route 単体テストをセットで書く。並列 PR 衝突を避けるため `app.ts` は直接編集しない。
---

# new-api-route スキル

新規 API route を Hono に追加する。route 追加 / バリデーション / テストの 3 点セットで揃える。

**初回 (`src/server/hono/` がまだ無い場合)**: 単発 route を作るだけでは動かない。まず [PLAN.md の「Hono API」](../../../PLAN.md#hono-api-srcserverhono) を参照し、`src/server/hono/app.ts` + `src/app/api/[[...route]]/route.ts` のマウント点 + `src/server/hono/middleware/{session,csrf,rate-limit}.ts` の骨格を **同じ PR で** 揃える。Phase 1 着手の最初の API PR は本スキルではなく [new-feature-tdd](../new-feature-tdd/SKILL.md) で TDD ループに乗せる。

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

`src/server/hono/routes/<name>.ts` に新しい Hono ルートを作る。**既存の `app.ts` は触らない** (バレル経由で自動登録される前提)。冒頭で `import 'server-only'` を必ず宣言する。

```ts
// src/server/hono/routes/posts.ts
import 'server-only'
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
- Supabase クライアントは `src/lib/supabase/server.ts` 経由の **authenticated client** を使う。`@supabase/supabase-js` を直接 import しない。`SUPABASE_SECRET_KEY` を使う `createClient` は [.claude/rules/api.md の「認可とサニタイズの責務」](../../rules/api.md) で列挙した 3 経路のみ。
- 認可判定は RLS に任せる。Hono ルート内で `if (user.role !== 'admin')` のような分岐を書かない (RLS で弾ければ supabase クライアントが error を返す)。
- レスポンスは必ず `c.json()` で構造化して返す。

### 2-a. state-changing route は Origin / CSRF + 必要なら rate limit

`POST` / `PUT` / `PATCH` / `DELETE` の route には `src/server/hono/middleware/csrf.ts` を必ず適用する (`app.ts` のバレル登録時に state-changing path を一括で wrap するのが基本)。匿名 endpoint (`/api/comments` 等) は追加で:

- `src/server/hono/middleware/rate-limit.ts` (1 IP / 分 5 件、時 30 件)
- Cloudflare Turnstile token の `siteverify` (route 内で `await verifyTurnstile(c.req.valid('json').turnstileToken)`)
- honeypot field (zod スキーマに `website: z.string().max(0).optional()`、値があれば 200 で silent drop)

詳細は [.claude/rules/api.md](../../rules/api.md) の「匿名コメント API のスパム対策」を参照。

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
- [ ] route ファイル冒頭に `import 'server-only'` を宣言した
- [ ] `app.ts` を編集していない (並列 PR の衝突回避)
- [ ] `@hono/zod-validator` で `json` / `query` / `param` をバリデートしている
- [ ] zod スキーマは `src/lib/schemas.ts` に置き、route から import している
- [ ] Supabase クライアントは `src/lib/supabase/server.ts` 経由 (authenticated client)
- [ ] state-changing route は CSRF/Origin middleware を通過している
- [ ] 匿名 / 未認証 endpoint なら rate limit + Turnstile + honeypot + 入力上限 (2000 char / URL 2 個) の 4 点セットを実装した
- [ ] 認可判定は RLS に委譲し、Hono 内で role 分岐を書いていない
- [ ] `SUPABASE_SECRET_KEY` を `'use client'` 配下に漏らしていない
- [ ] route 単体テストを `app.request()` で書いた
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` が緑
