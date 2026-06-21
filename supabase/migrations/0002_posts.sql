-- 0002_posts.sql
-- 記事テーブル + RLS (公開 SELECT は published のみ / admin 全件 / editor は自分の記事のみ)
-- updated_at は DB トリガーで自動更新 (アプリ層で明示更新しない、rules/supabase.md 「両用禁止」)。

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.editors(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  -- slug は先頭と末尾が英数字、内部のみハイフン可 (末尾ハイフン slug を弾く)。
  -- zod schema (src/lib/schemas.ts) と完全一致させる。
  slug text not null unique check (
    slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' and char_length(slug) <= 100
  ),
  content_md text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_status_published_at_idx
  on public.posts (status, published_at desc)
  where status = 'published';

create index posts_author_id_idx on public.posts (author_id);

alter table public.posts enable row level security;

-- 公開 SELECT: published のみ
create policy "posts_select_published"
  on public.posts
  for select
  using (status = 'published');

-- editor / admin は全件 SELECT 可 (草稿の管理画面用)
create policy "posts_select_editor"
  on public.posts
  for select
  using (public.current_editor_role() in ('admin', 'editor'));

-- admin: 全件 INSERT / UPDATE / DELETE
create policy "posts_admin_modify"
  on public.posts
  for all
  using (public.current_editor_role() = 'admin')
  with check (public.current_editor_role() = 'admin');

-- editor: 自分の記事のみ INSERT / UPDATE / DELETE
create policy "posts_editor_own"
  on public.posts
  for all
  using (
    author_id = (select id from public.editors where user_id = auth.uid())
  )
  with check (
    author_id = (select id from public.editors where user_id = auth.uid())
  );

-- updated_at 自動更新トリガー (アプリ側テーブル用なので grant 先は authenticated)
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
grant execute on function public.touch_updated_at() to authenticated;

create trigger posts_set_updated_at
  before update on public.posts
  for each row
  execute function public.touch_updated_at();

-- PostgREST から見えるよう明示 grant (Supabase の Automatically expose new tables を OFF 運用するため)。
-- 公開記事の SELECT は anon にも必要。書き込みは authenticated のみ (RLS が admin/editor に絞る)。
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
