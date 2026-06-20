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

- ユーザー投稿 / 外部入力の Markdown を HTML として描画する場合、必ず `src/lib/markdown.ts` の unified pipeline (`remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-sanitize` → `rehype-stringify`) を通す。
- `dangerouslySetInnerHTML` で生 HTML を直接埋め込まない。サニタイズを経由した結果のみ許可。
- raw HTML を Markdown 内に通したいケースが出ても、`rehype-sanitize` の allowlist を緩めない。要件が出たら別 PR で議論。

## 機密の取り扱い

- API キー / service role key などをクライアントコンポーネントから参照しない。
- `process.env.NEXT_PUBLIC_*` 以外の環境変数を `'use client'` 配下で読まない。読みたくなったら設計を疑う。
- フォーム送信は `<form action={serverAction}>` (Server Action) または fetch で Hono ルートを叩く形にする。クライアント側に資格情報を持たない。

## アクセシビリティ・命名

- フォーム要素は `<label>` と紐付ける (`htmlFor` または親要素として包む)。
- `alt` を空にしてよいのは純粋装飾画像のみ。意味のある画像には alt を必ず付ける。
- コンポーネントファイル名は PascalCase (`PostCard.tsx`)、props 型は `<ComponentName>Props` で統一する。
