import type { Metadata } from "next";

export type BuildPostMetadataInput = {
  title: string;
  description: string;
  slug: string;
};

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
