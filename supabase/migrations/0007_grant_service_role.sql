-- 0007_grant_service_role.sql
-- Supabase の `Automatically expose new tables` を OFF にしているため、
-- 新規テーブル / 関数の権限は anon / authenticated に手動 GRANT する設計にしている
-- (0001〜0005 マイグレーション参照)。だが service_role への GRANT も同様に書かないと
-- 漏れるため、本マイグレーションで一括補完する。
--
-- service_role は `BYPASSRLS` 属性で RLS を全部スキップするが、テーブルレベルの
-- GRANT 自体が無いと PostgreSQL は `permission denied` で弾く。
-- seed スクリプトや招待用 admin route (`auth.admin.inviteUserByEmail`) は
-- Supabase secret key 経由で叩き、内部的に service_role ロールで動作するため、
-- これらの権限が必須。

-- schema usage
grant usage on schema public to service_role;

-- 既存テーブル (0001〜0005 で定義済み)
grant select, insert, update, delete on public.editors to service_role;
grant select, insert, update, delete on public.posts to service_role;
grant select, insert, update, delete on public.comments to service_role;
grant select, insert, update, delete on public.rate_limits to service_role;

-- 既存関数 (0001〜0005 で定義済み)
grant execute on function public.current_editor_role() to service_role;
grant execute on function public.touch_updated_at() to service_role;
grant execute on function public.increment_rate_limit(text, timestamptz) to service_role;
grant execute on function public.cleanup_rate_limits() to service_role;
-- handle_new_user は auth.users トリガー専用で supabase_auth_admin が実行するため
-- service_role からの execute は理論上不要だが、整合性のため明示しておく。
grant execute on function public.handle_new_user() to service_role;

-- 将来のテーブル / 関数 / シーケンス追加時にも service_role に自動付与される
-- default privileges を設定。これにより以降のマイグレーションで service_role を
-- 個別に書き忘れても腐らない。
-- `FOR ROLE postgres` を明示しているのは、Supabase のマイグレーション実行ロール
-- (postgres) が作成した将来オブジェクトに限定するため。省略時の暗黙挙動と等価だが
-- 意図を読み手に残す。
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
