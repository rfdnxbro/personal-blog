-- 0006_storage_post_images.sql
-- Supabase Storage の `post-images` bucket を作成し、RLS で書き込みを admin / editor に絞る。
-- 読み取りは public (記事画像として外部から参照されるため)。

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

-- 既存 policy をクリーンに置き換えるため drop してから create する。
drop policy if exists "post_images_read_public" on storage.objects;
drop policy if exists "post_images_write_editor" on storage.objects;
drop policy if exists "post_images_update_editor" on storage.objects;
drop policy if exists "post_images_delete_editor" on storage.objects;

create policy "post_images_read_public"
  on storage.objects
  for select
  using (bucket_id = 'post-images');

create policy "post_images_write_editor"
  on storage.objects
  for insert
  with check (
    bucket_id = 'post-images'
    and public.current_editor_role() in ('admin', 'editor')
  );

create policy "post_images_update_editor"
  on storage.objects
  for update
  using (
    bucket_id = 'post-images'
    and public.current_editor_role() in ('admin', 'editor')
  )
  with check (
    bucket_id = 'post-images'
    and public.current_editor_role() in ('admin', 'editor')
  );

create policy "post_images_delete_editor"
  on storage.objects
  for delete
  using (
    bucket_id = 'post-images'
    and public.current_editor_role() in ('admin', 'editor')
  );
