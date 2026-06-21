import "server-only";

import type { MetadataRoute } from "next";
import { createServerClient } from "@/lib/supabase/server";

export type PublishedPostRow = { slug: string; updated_at: string | null };

/**
 * `posts.status = 'published'` の {slug, updated_at} を返すローダ。
 * Next の MetadataRoute シグネチャに引数を増やせない都合で sitemap() に
 * 注入できないため、テストでは `buildSitemap()` 経由で stub を渡す。
 */
export type PublishedPostsLoader = () => Promise<{
  data: PublishedPostRow[] | null;
  error: { message: string } | null;
}>;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

async function defaultLoader(): Promise<{
  data: PublishedPostRow[] | null;
  error: { message: string } | null;
}> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select("slug, updated_at")
    .eq("status", "published");
  return {
    data: (data ?? null) as PublishedPostRow[] | null,
    error: error ? { message: error.message } : null,
  };
}

/**
 * sitemap entries を組み立てる pure helper。loader を差し替えれば
 * Supabase を踏まずにテストできるよう DI 化してある。
 */
export async function buildSitemap(
  loader: PublishedPostsLoader = defaultLoader,
): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const { data, error } = await loader();

    if (error || !data) {
      return entries;
    }

    for (const post of data) {
      entries.push({
        url: `${base}/posts/${post.slug}`,
        lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    return entries;
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap();
}
