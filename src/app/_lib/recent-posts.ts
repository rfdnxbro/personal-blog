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
  error: { message: string } | null;
}>;

async function defaultLoader(limit: number): Promise<{
  data: RecentPost[] | null;
  error: { message: string } | null;
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
    error: error ? { message: error.message } : null,
  };
}

/**
 * loader を差し替え可能にした pure helper。Supabase を踏まずに
 * Vitest からテストできる。
 */
export async function buildRecentPublishedPosts(
  limit: number = 5,
  loader: RecentPostsLoader = defaultLoader,
): Promise<RecentPost[]> {
  try {
    const { data, error } = await loader(limit);
    if (error || !data) {
      return [];
    }
    return data;
  } catch {
    return [];
  }
}

/**
 * Server Component から直接使う薄いラッパ。env が無い CI のプリレンダ等で
 * 失敗しても UI 側が空配列扱いできるよう、必ず配列を返す。
 */
export async function fetchRecentPublishedPosts(
  limit: number = 5,
): Promise<RecentPost[]> {
  return buildRecentPublishedPosts(limit);
}
