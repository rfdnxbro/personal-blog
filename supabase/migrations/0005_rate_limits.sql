-- 0005_rate_limits.sql
-- 匿名コメント API の rate limit (sliding window 近似)。Hono middleware (`middleware/rate-limit.ts`)
-- が authenticated client 経由で SELECT + RPC increment_rate_limit() を叩く。
--
-- 設計判断: bucket には IP のプレフィックスが入るが、匿名コメント API 専用のスロットリングに
-- 用途を絞り、書き込みは RPC 1 本に集約する。匿名 INSERT/SELECT は RLS で許可する代わりに、
-- 関数経由のロジックで件数集計を行うため攻撃面は限定的。

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);

create index rate_limits_window_start_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

-- 公開コメント API は未ログインから叩かれるため anon / authenticated の SELECT/INSERT を許可。
-- bucket は IP 由来の opaque な文字列で、個人特定情報は含まれない。
create policy "rate_limits_select_all"
  on public.rate_limits
  for select
  using (true);

create policy "rate_limits_insert_all"
  on public.rate_limits
  for insert
  with check (true);

create policy "rate_limits_update_all"
  on public.rate_limits
  for update
  using (true)
  with check (true);

-- atomic increment 用 RPC。同一 (bucket, window_start) があれば count += 1、無ければ 1 で挿入。
create or replace function public.increment_rate_limit(
  p_bucket text,
  p_window_start timestamptz
)
returns void
language sql
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
create or replace function public.cleanup_rate_limits()
returns void
language sql
set search_path = public, pg_temp
as $$
  delete from public.rate_limits
  where window_start < now() - interval '2 hours';
$$;

revoke all on function public.cleanup_rate_limits() from public;
grant execute on function public.cleanup_rate_limits() to authenticated;
