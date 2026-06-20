-- 0003_comments.sql
-- 匿名コメントテーブル + RLS (公開 SELECT / 公開 INSERT / admin+editor が DELETE)。
-- スパム対策 (rate limit / Turnstile / honeypot / 入力上限) は Hono レイヤで担保。
-- IP / UA カラムは Phase 1 では追加しない (プライバシーポリシー整備とセットで段階導入)。

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 50),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index comments_post_id_created_at_idx
  on public.comments (post_id, created_at desc);

alter table public.comments enable row level security;

-- SELECT: 公開
create policy "comments_select_public"
  on public.comments
  for select
  using (true);

-- INSERT: 公開 (匿名)
create policy "comments_insert_public"
  on public.comments
  for insert
  with check (true);

-- DELETE: admin + editor
create policy "comments_delete_editor"
  on public.comments
  for delete
  using (public.current_editor_role() in ('admin', 'editor'));
