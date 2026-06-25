import type { Metadata } from "next";

export type BuildPostMetadataInput = {
  title: string;
  description: string;
  slug: string;
};

// Markdown 本文から description (OGP / meta description 用) を抽出する。
// rehype-sanitize までは噛ませず、見出し / 引用 / リスト / コードフェンスを素朴に除去する
// 軽量ヘルパ。テスト容易性のため pure 関数として export する。
export function extractDescription(md: string, maxLength = 160): string {
  if (!md) {
    return "";
  }

  const withoutFences = md.replace(/```[\s\S]*?```/g, " ");

  const stripped = withoutFences
    .split("\n")
    .map((line) => line.replace(/^\s*(?:#+\s+|>\s+|[-*]\s+|\d+\.\s+)/, ""))
    .join(" ");

  const collapsed = stripped.replace(/\s+/g, " ").trim();

  return collapsed.slice(0, maxLength);
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function buildPostMetadata({
  title,
  description,
  slug,
}: BuildPostMetadataInput): Metadata {
  const base = siteUrl();
  const url = `${base}/posts/${slug}`;
  const ogImage = `${base}/og?title=${encodeURIComponent(title)}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
