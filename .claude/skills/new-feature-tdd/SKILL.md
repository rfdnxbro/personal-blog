---
name: new-feature-tdd
description: 新機能を red → green → refactor の TDD サイクルで実装する手順。Vitest または Playwright で先に失敗するテストを書き、最小実装で緑にし、テストを緑のまま保ってリファクタする。機能 PR の標準フロー。
---

# new-feature-tdd スキル

新機能の実装は必ず TDD で進める。red → green → refactor の 3 ステップを徹底する。

## 手順

### 1. red: 失敗するテストを書く

まず期待する挙動をテストで宣言する。実装コードは書かない。

- **どこに書くか**
  - 単体 / 結合: `src/**/__tests__/*.test.ts(x)` または対象ファイルの同階層に `<name>.test.ts(x)`
  - HTTP route 単体: `src/server/hono/routes/__tests__/<name>.test.ts` で `app.request()` 経由
  - ブラウザ動作: `e2e/<feature>.spec.ts` で Playwright
- **粒度**
  - 1 つの it ブロック = 1 つの観察可能な振る舞い。「ボタンを押すと投稿が公開状態になる」のような外形的な仕様を書く。実装詳細 (内部関数の呼び出し回数など) に踏み込まない。
- **書き方**: AAA パターン (Arrange / Act / Assert) で構造化する。詳細は `.claude/rules/testing.md` を参照。

書いたら `pnpm test` (もしくは `pnpm test:watch`) を実行し、**期待通り失敗する** ことを確認する。

> red の確認は必須。テストが間違って「常に通る」状態になっていると以降のステップが破綻する。

### 2. green: 最小実装で通す

テストを通すために必要な、**最小限のコード** を書く。

- 過剰な抽象化・汎用化はしない。「将来こう使うかもしれない」を排除する。
- 失敗していたテストが緑になり、既存テストが壊れていないことを `pnpm test` で確認する。

### 3. refactor: 整理する

テストが緑の状態を保ったまま、コードの質を上げる。

- 重複の除去 (3 回出てきたら関数化を検討)
- 命名の改善 (テスト名・変数名)
- 早期 return での条件分岐の平坦化
- マジックナンバー / 文字列リテラルの定数化
- リファクタの途中で 1 回でもテストが落ちたら、refactor を中断して元に戻す (リファクタとロジック変更を混ぜない)

### 4. 仕上げ

PR を開く前に必ず以下をローカルで通す:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

ブラウザ動作を伴う変更なら `pnpm test:e2e` も追加。

## チェックリスト

- [ ] テストを先に書き、red で失敗を確認した
- [ ] 最小実装で green にした
- [ ] テストを緑に保ったままリファクタした
- [ ] 1 PR = 1 関心事 (差分目安 400 行以下)
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` が緑
- [ ] PR 本文に「何を / なぜ / どう検証したか」を書いた
