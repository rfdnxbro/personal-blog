import type { Metadata } from "next";

export type BuildPostMetadataInput = {
  title: string;
  description: string;
  slug: string;
};

// Markdown 本文から description (OGP / meta description 用) を抽出する。
// rehype-sanitize までは噛ませず、見出し / 引用 / リスト / コードフェンス / 一般的な
// インライン markdown 記法 (emphasis / code / link / image) を素朴に除去する軽量ヘルパ。
// テスト容易性のため pure 関数として export する。
export function extractDescription(md: string, maxLength = 160): string {
  if (!md) {
    return "";
  }

  // 1. fenced code blocks (``` ... ``` および ~~~ ... ~~~) を除去。
  const withoutFences = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ");

  // 2. 行頭の block-level マーカー (見出し / 引用 / リスト) を除去して 1 行に結合。
  const blockStripped = withoutFences
    .split("\n")
    .map((line) => line.replace(/^\s*(?:#+\s+|>\s+|[-*]\s+|\d+\.\s+)/, ""))
    .join(" ");

  // 3. インライン markdown を素朴に剥がす。順番に意味があり、画像 → リンク → 強調 → コードの順で処理する。
  const inlineStripped = blockStripped
    // 画像 ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // リンク [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // 強調 / 取消 / 斜体 — マーカー文字だけを除去する。
    // ** ... ** / __ ... __ / * ... * / _ ... _ / ~~ ... ~~
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "$1")
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    // インラインコード `code` → code
    .replace(/`([^`]+)`/g, "$1");

  const collapsed = inlineStripped.replace(/\s+/g, " ").trim();

  // 4. サロゲートペア (絵文字など) を割らないようコードポイント単位で切り出し、
  //    省略時は末尾に … を付ける。
  const codepoints = Array.from(collapsed);
  if (codepoints.length <= maxLength) {
    return collapsed;
  }
  return `${codepoints.slice(0, maxLength).join("")}…`;
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
