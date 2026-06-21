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

-- current_editor_role(): editors の role を別テーブルの RLS から参照する経路。
-- SECURITY DEFINER で editors の RLS を bypass しつつ、戻り値だけ露出させる。
-- editors 自身の policy 内からも呼んで自己参照無限再帰を回避する (rules/supabase.md 参照)。
-- stable: 同一ステートメント内でキャッシュ可、別ステートメントでは再計算。
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

-- SELECT: 自分の行のみ + admin は全件
-- editors policy 内で editors を subquery 参照すると無限再帰になるため、
-- 上で定義した SECURITY DEFINER 関数を経由する。
create policy "editors_select_self_or_admin"
  on public.editors
  for select
  using (
    user_id = auth.uid()
    or public.current_editor_role() = 'admin'
  );

-- INSERT / UPDATE / DELETE: admin のみ
create policy "editors_admin_modify"
  on public.editors
  for all
  using (public.current_editor_role() = 'admin')
  with check (public.current_editor_role() = 'admin');

-- PostgREST から見えるよう明示 grant (Supabase の Automatically expose new tables を OFF 運用するため)。
-- editors は認証済みユーザーのみ触れる (anon は不要)。
grant select, insert, update, delete on public.editors to authenticated;
