import "server-only";

import type { MetadataRoute } from "next";
import { createServerClient } from "@/lib/supabase/server";

type PublishedPostRow = { slug: string; updated_at: string | null };

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("posts")
      .select("slug, updated_at")
      .eq("status", "published");

    if (error || !data) {
      return entries;
    }

    for (const post of data as PublishedPostRow[]) {
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
