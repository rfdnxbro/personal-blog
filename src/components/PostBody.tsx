import { renderMarkdownToSafeHtml } from "@/lib/markdown";

export type PostBodyProps = {
  contentMd: string;
};

export default async function PostBody({ contentMd }: PostBodyProps) {
  const html = await renderMarkdownToSafeHtml(contentMd);
  return (
    <div
      className="prose prose-invert max-w-none"
      // renderMarkdownToSafeHtml は sanitize 済み (rules/components.md)
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitize 済みの安全な HTML を埋め込む
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
