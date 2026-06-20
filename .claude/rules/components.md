---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
---

# コンポーネント規約

React コンポーネント (Server / Client) に適用される規約。Next.js 16 App Router 前提。

## Server Component が既定

- `src/app/**/*.tsx` と `src/components/**` の新規コンポーネントは原則 Server Component として書く。
- `'use client'` を付けるのは以下のいずれかが必要な場合だけ。
  - `useState` / `useReducer` / `useEffect` などフックでローカル状態を扱う
  - `onClick` / `onChange` などイベントハンドラを DOM に渡す
  - ブラウザ専用 API (`window`, `document`, `localStorage`) を使う
- 「念のため client にしておく」を禁止する。Server Component で書ける UI を client 化するとバンドルが膨らみ、データ取得もクライアント往復になる。
- 部分的にインタラクティブな UI は、親を Server Component に保ち、子の小さな部分だけを `'use client'` にする (composition pattern)。

## next/image と next/link

- 生 `<img src="...">` を書かない。代わりに `next/image` の `<Image />` を使う。サイズ最適化と LCP 最適化を Next に委ねる。
  ```tsx
  import Image from 'next/image'

  <Image src="/cover.png" alt="cover" width={1200} height={630} priority />
  ```
- 内部リンクに生 `<a href="/posts">` を書かない。代わりに `next/link` の `<Link />` を使う。プリフェッチとクライアント遷移を効かせる。
- 外部リンク (`<a href="https://...">`) は素の `<a>` で良いが、`target="_blank"` を付けるなら `rel="noopener noreferrer"` を必ず併記する。
- Biome には Next 専用ルールが現状無いので、ここで規約として担保する。

## Markdown のサニタイズ

- ユーザー投稿 / 外部入力の Markdown を HTML として描画する場合、必ず `src/lib/markdown.ts` の `renderMarkdownToSafeHtml(md: string): string` ヘルパを通す。pipeline は `remark-parse` → `remark-gfm` → `remark-rehype` (`allowDangerousHtml: false`) → `rehype-pretty-code` → `rehype-sanitize` → `rehype-stringify`。
- 投稿は **保存時にサニタイズしない**。`posts.content_md` に生 Markdown のまま保存し、表示時の単一入口で必ずサニタイズする (責務の二重化を避ける)。
- `dangerouslySetInnerHTML` で生 HTML を直接埋め込まない。`renderMarkdownToSafeHtml` の戻り値のみを `dangerouslySetInnerHTML` に渡すことを許可する。
- raw HTML を Markdown 内に通したいケースが出ても、`rehype-sanitize` の allowlist を緩めない。要件が出たら別 PR で議論。

### sanitize schema の固定

- schema は `rehype-sanitize` の `defaultSchema` を基点に、以下を **必ず固定** する:
  - `attributes.a.href` の protocol allowlist を `http` / `https` / `mailto` のみに絞る
  - `attributes.img.src` の protocol allowlist も同様
  - `data:` / `javascript:` / `file:` 系の URI はすべて排除
  - `rehype-pretty-code` が付与する `data-*` 属性と `className` (`code-line`, `highlighted` など) のみを明示的に追加 allow する
- 上記 schema 定義は `src/lib/markdown.ts` に集約し、他モジュールから上書きできないように export しない (もしくは `Object.freeze` する)。

### コメントは plain text 描画

- コメント本文 (`comments.body`) は **plain text + 改行のみ**。Markdown レンダリングしない (XSS 表面積最小化)。
- 表示時は React の自動エスケープのみで十分。`<br />` 化したい場合は文字列を改行で split して `<p>` を並べる方式に留め、`dangerouslySetInnerHTML` は使わない。

### XSS ゴールデンテスト

- `src/lib/markdown.ts` の実装 PR には以下の入力を含む Vitest ゴールデンテスト (`src/lib/markdown.test.ts`) を **必ず同梱** する:
  - `<script>alert(1)</script>`
  - `[click](javascript:alert(1))` / `[click](data:text/html,<script>alert(1)</script>)`
  - `<img src=x onerror=alert(1)>`
  - `<svg onload=alert(1)></svg>`
  - `<iframe src="javascript:alert(1)"></iframe>`
  - `<a href="http://example.com" target="_blank">` (rel に noopener noreferrer が付くこと)
- 出力に `<script>` / `javascript:` / `onerror=` / `onload=` などが残らないことを `expect(html).not.toMatch(/.../)` で全件チェックする。

## 機密の取り扱い

- API キー / service role key などをクライアントコンポーネントから参照しない。
- `process.env.NEXT_PUBLIC_*` 以外の環境変数を `'use client'` 配下で読まない。読みたくなったら設計を疑う。
- フォーム送信は `<form action={serverAction}>` (Server Action) または fetch で Hono ルートを叩く形にする。クライアント側に資格情報を持たない。

## アクセシビリティ・命名

- フォーム要素は `<label>` と紐付ける (`htmlFor` または親要素として包む)。
- `alt` を空にしてよいのは純粋装飾画像のみ。意味のある画像には alt を必ず付ける。
- コンポーネントファイル名は PascalCase (`PostCard.tsx`)、props 型は `<ComponentName>Props` で統一する。
