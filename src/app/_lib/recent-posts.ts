import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export type RecentPost = {
  id: string;
  slug: string;
  title: string;
  published_at: string | null;
};

/**
 * 公開済み posts のうち最新 N 件を `(id, slug, title, published_at)` で返すローダ。
 * Server Component から差し替え不可能なため、テストでは `buildRecentPublishedPosts()`
 * 経由で stub を渡す。
 */
export type RecentPostsLoader = (limit: number) => Promise<{
  data: RecentPost[] | null;
  error: { message: string; code?: string } | null;
}>;

/**
 * page.tsx 側で「error」と「empty」を別 UI に出し分けるための戻り値。
 * RLS / env 未設定で loader が落ちた場合 (`error !== null`) と単に投稿が
 * 0 件の場合 (`posts.length === 0`) はユーザー体験が違うので分ける。
 */
export type RecentPostsResult = {
  posts: RecentPost[];
  error: string | null;
};

async function defaultLoader(limit: number): Promise<{
  data: RecentPost[] | null;
  error: { message: string; code?: string } | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, slug, title, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  return {
    data: (data ?? null) as RecentPost[] | null,
    error: error
      ? {
          message: error.message,
          code: (error as { code?: string }).code,
        }
      : null,
  };
}

/**
 * loader を差し替え可能にした pure helper。Supabase を踏まずに
 * Vitest からテストできる。loader が error を返した／throw した場合は
 * 運用ログに残せるよう `console.error` で構造化ログを 1 行吐く。
 */
export async function buildRecentPublishedPosts(
  limit: number = 5,
  loader: RecentPostsLoader = defaultLoader,
): Promise<RecentPostsResult> {
  try {
    const { data, error } = await loader(limit);
    if (error) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "recent_posts_fetch_failed",
          code: error.code ?? null,
          message: error.message,
        }),
      );
      return { posts: [], error: error.message };
    }
    return { posts: data ?? [], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: "error",
        msg: "recent_posts_fetch_failed",
        code: null,
        message,
      }),
    );
    return { posts: [], error: message };
  }
}

/**
 * Server Component から直接使う薄いラッパ。env が無い CI のプリレンダ等で
 * 失敗しても UI 側が `{ posts: [], error }` で扱えるよう、必ず両方を返す。
 */
export async function fetchRecentPublishedPosts(
  limit: number = 5,
): Promise<RecentPostsResult> {
  return buildRecentPublishedPosts(limit);
}
