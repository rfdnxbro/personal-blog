---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**"
---

# テスト規約

このプロジェクトのテストコードに適用される規約。Vitest 4 + Playwright 1.61 を利用する。

## 共通: AAA パターン

すべてのテストは Arrange / Act / Assert の 3 ステップで構造化する。視認性のため空行で区切るのが望ましい。

```ts
it('returns published posts only', async () => {
  // Arrange
  const draft = await createPost({ status: 'draft' })
  const published = await createPost({ status: 'published' })

  // Act
  const result = await listPublishedPosts()

  // Assert
  expect(result).toContainEqual(published)
  expect(result).not.toContainEqual(draft)
})
```

ネストした `describe` で冗長な before/after を積み重ねない。setup が複雑なら共有ヘルパ関数に切り出す。

## Vitest 用 (`*.test.ts` / `*.test.tsx`)

### 過剰モック禁止

- 自分のコード (`src/` 配下) はできるだけ実体を呼ぶ。`vi.mock` を当てるのは原則として **外部 I/O** (Supabase クライアント / fetch / 環境変数依存) と **時刻** のみ。
- 1 ファイル内で `vi.mock` が 3 つを超えたら設計を疑う。テスト対象が依存に縛られすぎている可能性が高い。
- 部分モックを多用しない。`vi.mocked()` で型を取り戻すコストを払うくらいなら、依存注入で差し替える設計に変える。

### Supabase / Hono のテスト

- ルーティング層は Hono の `app.request()` で fetch 風に叩く。HTTP モック (msw 等) は使わない。
- Supabase クライアントはテストごとに stub を渡せるよう、関数引数または factory として注入する。`@supabase/ssr` 自体をモジュールモックしない。

### 非同期テスト

- `await` を必ず付ける。`return promise` 形式は禁止 (await 漏れの検出が困難)。
- `vi.useFakeTimers()` を使ったら同じ `it` の終わりで `vi.useRealTimers()` を必ず戻す。

## Playwright 用 (`e2e/**`)

### flake しないアサーション

- DOM の出現待ちには `expect(locator).toBeVisible()` などの **auto-retry assertion** を使う。`page.waitForTimeout` で固定 sleep を入れない。
- 文字列マッチは `toHaveText(/.../)` の正規表現で揺れを吸収する。フォーマット差で壊れやすい完全一致 (`toHaveText('Posts (3)')`) は避ける。
- ネットワーク待ちは `page.waitForResponse(url predicate)` で具体化。`networkidle` は SPA で永久待ちになりがちなので原則使わない。

### locator の選び方

優先度: `getByRole` > `getByLabel` / `getByPlaceholder` > `getByTestId` > CSS / XPath。CSS セレクタや nth-child に依存したテストは UI 差分で壊れやすい。

### 認証フロー

- ログイン状態は `storageState` で再利用する。各テストで login form を踏ませない。
- service role key を E2E で使わない。テスト専用ユーザーを seed して匿名 / 認証済みの両系統を回す。
