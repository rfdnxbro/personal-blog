---
paths:
  - "supabase/**"
---

# Supabase 規約

`supabase/` 配下のマイグレーション・設定ファイルに適用される規約。

## マイグレーション命名

- ファイル名は `supabase/migrations/NNNN_snake_case.sql`。
- `NNNN` は 4 桁ゼロ詰めの連番 (例: `0001_init.sql`, `0002_posts.sql`, `0003_handle_new_user.sql`)。
- 連番は順序保証のため必ずインクリメントする。同番号で別ファイルを作らない。マージ時にコンフリクトが起きたら番号を取り直す。
- snake_case のみ。kebab-case や日付プレフィックス (`20240601_*`) は使わない。

## RLS は既定 ON

- 新規テーブルを作成したら、同じマイグレーション内で必ず以下を書く。

  ```sql
  create table public.posts (
    id uuid primary key default gen_random_uuid(),
    -- ...
  );

  alter table public.posts enable row level security;
  ```

- **`alter table ... disable row level security` を書かない**。例外的に必要な場合はレビューで議論し、別ファイルで明示的に切る (本リポジトリでは現時点で許容ケース無し)。
- 各テーブルに対して `select` / `insert` / `update` / `delete` の policy を最小権限原則で書く。「全許可」policy (`using (true)`) を安易に置かない。

## トリガー / 関数

- DB トリガーで auth スキーマや別ユーザーのデータを触る関数は `security definer` を付け、所有者の権限で実行されることを明示する。
- 関数は `search_path = public, pg_temp` を明示的に設定し、`search_path` 経由の権限奪取を防ぐ。

  ```sql
  create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    insert into public.profiles (id) values (new.id);
    return new;
  end;
  $$;
  ```

- `security definer` を付けたら必ず `revoke all on function ... from public` と `grant execute on function ... to <role>` で実行権限を絞る。

## マイグレーションの粒度

- 1 マイグレーション = 1 関心事 (1 テーブル追加 + 関連する policy / index / trigger まで)。複数機能を 1 ファイルに混ぜない。
- ロールバック手順は別途記述しない (Supabase の運用上 down マイグレーションは扱わない)。必要なら逆方向のマイグレーションを新規 `NNNN_revert_*.sql` として追加する。

## ローカル検証

- 新規マイグレーションを書いたら `supabase db reset` (もしくは equivalent) でフルリセットが通ることを確認する。連番の途中で壊れていないか必ずチェック。
