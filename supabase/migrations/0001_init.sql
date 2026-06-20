-- 0001_init.sql
-- editors テーブル + 許可リスト判定用の email_normalized 生成列 + current_editor_role() ヘルパ。
-- 他テーブルの RLS から editors の role を引くときの SECURITY DEFINER 再帰回避経路。

create table public.editors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text not null unique,
  email_normalized text generated always as (lower(email)) stored unique,
  role text not null check (role in ('admin', 'editor')),
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.editors enable row level security;

-- SELECT: 自分の行のみ + admin は全件
create policy "editors_select_self_or_admin"
  on public.editors
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.editors e
      where e.user_id = auth.uid() and e.role = 'admin'
    )
  );

-- INSERT / UPDATE / DELETE: admin のみ
create policy "editors_admin_modify"
  on public.editors
  for all
  using (
    exists (
      select 1 from public.editors e
      where e.user_id = auth.uid() and e.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.editors e
      where e.user_id = auth.uid() and e.role = 'admin'
    )
  );

-- current_editor_role(): editors の role を別テーブルの RLS から参照する経路。
-- SECURITY DEFINER で editors の RLS を bypass しつつ、戻り値だけ露出させる。
-- stable: 同一ステートメント内でキャッシュ可、別ステートメントでは再計算 (rules/supabase.md 参照)。
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
