---
name: new-migration
description: Supabase の新しい SQL マイグレーションをテンプレ通りに生成する手順。テーブル追加・カラム変更・トリガー追加などで `supabase/migrations/NNNN_*.sql` を新規作成するときに使う。RLS の有効化と最小権限ポリシーをテンプレに含める。
---

# new-migration スキル

新規 Supabase マイグレーションを `supabase/migrations/NNNN_snake_case.sql` のテンプレ通りに生成する。

## 手順

### 1. 連番を決める

`supabase/migrations/` 配下を `ls` で確認し、既存の最大番号 + 1 を採用する。例: 最大が `0004_*.sql` なら `0005_*` で作る。

並列で他の PR が走っている可能性があるので、main ブランチに対する最新の状態で番号を確認する。

**初回 (まだ migration が無い / `supabase/migrations/` ディレクトリ自体が無い場合)**:
- `mkdir -p supabase/migrations` してから `0001_init.sql` で開始する
- 最初の migration は editors / posts / comments / handle_new_user / RLS / current_editor_role を一気に入れず、分割すること (1 マイグレーション = 1 関心事)。推奨順:
  1. `0001_init.sql` — editors テーブル + `email_normalized` 生成列 + RLS + `current_editor_role()` 関数
  2. `0002_posts.sql` — posts テーブル + RLS + `moddatetime` トリガー (`touch_updated_at()`)
  3. `0003_comments.sql` — comments テーブル + RLS
  4. `0004_handle_new_user.sql` — `handle_new_user()` 関数 + `auth.users` トリガー
- 詳細スキーマは [PLAN.md の「データモデル」](../../../PLAN.md#データモデル-supabasemigrations0001_initsql) を参照。

### 2. ファイル名を決める

`NNNN_snake_case.sql` の形式。

- 良い例: `0005_add_post_tags.sql`, `0006_drop_unused_index.sql`, `0007_handle_new_user.sql`
- 悪い例: `0005_AddPostTags.sql` (camelCase 禁止), `2026-06-20_add_tags.sql` (日付プレフィックス禁止), `0005_add-tags.sql` (kebab-case 禁止)

### 3. テンプレを貼って中身を埋める

#### テーブル追加のテンプレ

```sql
-- supabase/migrations/NNNN_<verb>_<subject>.sql
-- 説明: <この変更で何を実現したいかを 1-2 行>

create table public.<table_name> (
  id uuid primary key default gen_random_uuid(),
  -- カラム定義
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS 必須
alter table public.<table_name> enable row level security;

-- policy: 最小権限で書く。「全許可」(using (true)) を安易に使わない
create policy "<table_name>_select_public"
  on public.<table_name>
  for select
  using (<条件>);

create policy "<table_name>_modify_owner"
  on public.<table_name>
  for all
  using (auth.uid() = <owner_column>)
  with check (auth.uid() = <owner_column>);
```

#### トリガー / 関数追加のテンプレ

トリガーをぶら下げる先によって `grant execute` の宛先が違う点に注意 (テンプレを混同しないこと)。

##### A. `auth.users` 用 (サインアップ時の許可リスト判定など)

```sql
create or replace function public.<function_name>()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 処理 (auth スキーマや editors を参照する)
  return new;
end;
$$;

revoke all on function public.<function_name>() from public;
grant execute on function public.<function_name>() to supabase_auth_admin;  -- ★ auth.users トリガーは supabase_auth_admin が実行

create trigger <trigger_name>
  after insert on auth.users
  for each row
  execute function public.<function_name>();
```

##### B. アプリ側テーブル用 (`updated_at` の自動更新など)

```sql
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public;
grant execute on function public.touch_updated_at() to authenticated;  -- ★ アプリ側は authenticated

create trigger <table>_set_updated_at
  before update on public.<table>
  for each row
  execute function public.touch_updated_at();
```

#### `handle_new_user` リファレンス実装 (許可リスト方式)

`editors.email_normalized` (`generated always as (lower(email)) stored`) で許可リスト判定する。許可リスト外は `raise exception` でサインアップ自体を中断する。

```sql
-- supabase/migrations/0004_handle_new_user.sql
-- editors に許可された email でのみサインアップを許可するトリガー

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_editor_id uuid;
begin
  select id into v_editor_id
    from public.editors
    where email_normalized = lower(new.email)
    limit 1;

  if v_editor_id is null then
    raise exception 'email % is not in the editors allowlist', new.email
      using errcode = 'P0001';
  end if;

  update public.editors
    set user_id = new.id
    where id = v_editor_id;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
```

#### `editors` の `email_normalized` (`0001_init.sql` の抜粋)

`handle_new_user` の判定は `lower(email)` 同士で行う。`editors.email` を直接比較すると Gmail などの大小違いでロックアウトされる。

```sql
create table public.editors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null unique,
  email_normalized text generated always as (lower(email)) stored unique,
  role text not null check (role in ('admin','editor')),
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.editors enable row level security;
```

### 4. 検証

- `ls supabase/migrations/` で番号が連続していることを確認。
- ローカル DB で `supabase db reset` を実行し、フルリセットが通ることを確認 (Supabase CLI が入っていれば)。
- マイグレーション内で参照しているテーブル / カラム / 関数が、それまでのマイグレーションで定義済みであることを確認。

## チェックリスト

- [ ] ファイル名が `NNNN_snake_case.sql` 形式
- [ ] 連番が既存の最大 + 1 (空の場合は `0001` から)
- [ ] 新規テーブルには `enable row level security` を必ず付与
- [ ] policy を最小権限で記述 (`using (true)` を避ける)
- [ ] `security definer` 関数には `set search_path` と `revoke / grant` を併記
- [ ] `auth.users` トリガー関数は `grant execute ... to supabase_auth_admin`、application 用は `to authenticated` を使い分けた
- [ ] 1 マイグレーション = 1 関心事を保てている
