import type { MetadataRoute } from "next";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl().replace(/\/$/, "");
  // /api/ 全体を blanket Disallow にすると今後追加する public read API
  // (例: /api/posts のサイト内検索など) もクロール対象から外れてしまうため、
  // 認証必須の /api/admin/ だけを明示的に Disallow する。
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/admin/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
