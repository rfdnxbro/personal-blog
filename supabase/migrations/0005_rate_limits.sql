-- 0005_rate_limits.sql
-- 匿名コメント API の rate limit (sliding window 近似)。Hono middleware (`middleware/rate-limit.ts`)
-- が SELECT (件数集計) + RPC `increment_rate_limit()` (atomic な count UPDATE) を叩く。
--
-- 設計判断:
--   - 書き込み (INSERT / UPDATE) は SECURITY DEFINER の `increment_rate_limit` 経由のみに絞り、
--     呼び出し元 (anon / authenticated) には直接の INSERT / UPDATE 権限を渡さない。
--     これにより `POST /rest/v1/rate_limits` で任意 bucket の count を 0 にリセットする
--     攻撃経路を塞ぐ (PR #13 review issue #3)。
--   - SELECT は middleware の件数集計に必要なので anon / authenticated に開放する。
--     bucket は IP プレフィックスを含む opaque な文字列で個人特定情報は持たせない。

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);

create index rate_limits_window_start_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

-- SELECT のみ public 許可 (件数集計用)。書き込みは RLS policy を作らず、RPC 経由でのみ通す。
create policy "rate_limits_select_all"
  on public.rate_limits
  for select
  using (true);

-- atomic increment 用 RPC。同一 (bucket, window_start) があれば count += 1、無ければ 1 で挿入。
-- SECURITY DEFINER: 関数所有者 (postgres) の権限で実行されるため、呼び出し元 (anon / authenticated)
-- がテーブル直接の INSERT / UPDATE 権限を持たなくても関数経由なら書き込める。これにより
-- count リセット攻撃を関数ロジックで防ぐ。
create or replace function public.increment_rate_limit(
  p_bucket text,
  p_window_start timestamptz
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, p_window_start, 1)
  on conflict (bucket, window_start)
  do update set count = public.rate_limits.count + 1;
$$;

revoke all on function public.increment_rate_limit(text, timestamptz) from public;
grant execute on function public.increment_rate_limit(text, timestamptz) to anon, authenticated;

-- 古いウィンドウのクリーンアップ用 (cron / 定期実行で叩く想定、Phase 1 では手動)。
-- こちらも SECURITY DEFINER でテーブル DELETE 権限を呼び出し元に渡さずに済ませる。
create or replace function public.cleanup_rate_limits()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.rate_limits
  where window_start < now() - interval '2 hours';
$$;

revoke all on function public.cleanup_rate_limits() from public;
grant execute on function public.cleanup_rate_limits() to authenticated;

-- PostgREST から見えるよう明示 grant (Supabase の Automatically expose new tables を OFF 運用するため)。
-- SELECT のみ。INSERT / UPDATE / DELETE は SECURITY DEFINER 関数経由でのみ。
grant select on public.rate_limits to anon, authenticated;
