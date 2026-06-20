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

```sql
create or replace function public.<function_name>()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 処理
  return new;
end;
$$;

revoke all on function public.<function_name>() from public;
grant execute on function public.<function_name>() to authenticated;

create trigger <trigger_name>
  after insert on auth.users
  for each row
  execute function public.<function_name>();
```

### 4. 検証

- `ls supabase/migrations/` で番号が連続していることを確認。
- ローカル DB で `supabase db reset` を実行し、フルリセットが通ることを確認 (Supabase CLI が入っていれば)。
- マイグレーション内で参照しているテーブル / カラム / 関数が、それまでのマイグレーションで定義済みであることを確認。

## チェックリスト

- [ ] ファイル名が `NNNN_snake_case.sql` 形式
- [ ] 連番が既存の最大 + 1
- [ ] 新規テーブルには `enable row level security` を必ず付与
- [ ] policy を最小権限で記述 (`using (true)` を避ける)
- [ ] `security definer` 関数には `set search_path` と `revoke / grant` を併記
- [ ] 1 マイグレーション = 1 関心事を保てている
