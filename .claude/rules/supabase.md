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

### grant 先の使い分け (重要)

トリガーをぶら下げる先によって grant 先が違う。テンプレ通りに `authenticated` に grant すると `auth.users` トリガーは permission denied で落ちる。

| トリガー先 | grant 先 | 用途 |
|---|---|---|
| `auth.users` | `supabase_auth_admin` | サインアップ時の許可リスト判定、editors 紐付けなど |
| `public.<app_table>` | `authenticated` (場合により `anon`) | アプリ側テーブルの updated_at 自動更新など |

```sql
-- auth.users トリガー用 (例: handle_new_user)
revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
```

```sql
-- application table トリガー用 (例: posts.updated_at の moddatetime)
revoke all on function public.touch_updated_at() from public;
grant execute on function public.touch_updated_at() to authenticated;

create trigger posts_set_updated_at
  before update on public.posts
  for each row
  execute function public.touch_updated_at();
```

### RLS から editors の role を引く時のパターン

`editors` の `role` を別テーブルの RLS ポリシーから参照するときに、`editors` を `using (true)` で開放すると全メール/ロールが他 `authenticated` に漏れる。`SECURITY DEFINER` 関数を経由して RLS を bypass しつつ、関数の戻り値だけを露出させる方式に統一する。

```sql
create or replace function public.current_editor_role()
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select role from public.editors where user_id = auth.uid()
$$;

revoke all on function public.current_editor_role() from public;
grant execute on function public.current_editor_role() to authenticated;

-- 利用例: posts の policy
create policy "posts_admin_modify"
  on public.posts
  for all
  using (public.current_editor_role() = 'admin')
  with check (public.current_editor_role() = 'admin');
```

`stable` を付けている意図:

- 同一ステートメント内 (1 つのクエリ) で同じ引数 (ここでは `auth.uid()`) なら結果を再評価せずキャッシュしてよい、という Postgres 最適化ヒント
- `editors` が UPDATE されたら **次のステートメント** からは新しい値が引かれる (`stable` は immutable ではないので、別クエリでは再計算される)
- RLS planner が `current_editor_role()` を述語に含むポリシーを 1 行ずつ再評価せずプリペアできるため必須に近い
- `volatile` にすると行ごとに再評価され RLS が遅くなる。`immutable` にすると `editors` を更新しても旧値が返り続け事故になる。`stable` が正解。

### updated_at の方針 (両用禁止)

`updated_at` を持つテーブルでは **DB トリガー (`moddatetime` 相当) か アプリ層明示更新の どちらか 1 つだけ** を選ぶ。両用は禁止 (片方を忘れた瞬間に時刻がずれる)。本リポジトリでは DB トリガー方式に統一する。

## マイグレーションの粒度

- 1 マイグレーション = 1 関心事 (1 テーブル追加 + 関連する policy / index / trigger まで)。複数機能を 1 ファイルに混ぜない。
- ロールバック手順は別途記述しない (Supabase の運用上 down マイグレーションは扱わない)。必要なら逆方向のマイグレーションを新規 `NNNN_revert_*.sql` として追加する。

## ローカル検証

- 新規マイグレーションを書いたら `supabase db reset` (もしくは equivalent) でフルリセットが通ることを確認する。連番の途中で壊れていないか必ずチェック。
