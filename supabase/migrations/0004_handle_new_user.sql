-- 0004_handle_new_user.sql
-- editors テーブルに事前登録された email でのみサインアップを許可するトリガー。
-- email_normalized (lower(email)) で照合し、許可リスト外は raise exception でサインアップ自体を中断。
-- メッセージに email を含めない (列挙攻撃の情報源にしない、rules/supabase.md 「handle_new_user リファレンス実装」参照)。

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
    raise exception 'unauthorized email for signup'
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
