import "server-only";

import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// sanitize schema: defaultSchema を基点に rehype-pretty-code の属性 / className と
// 厳格な protocol allowlist (http / https / mailto) を加える。
// 外部から書き換えられないよう Object.freeze する (rules/components.md 要件)。
const SAFE_SCHEMA = Object.freeze({
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "figure"],
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []).filter(
        (entry) =>
          !(Array.isArray(entry) && entry[0] === "href") && entry !== "href",
      ),
      ["href", /^(https?:|mailto:)/i],
      "target",
      ["rel", /^(noopener|noreferrer|nofollow|\s)+$/i],
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []).filter(
        (entry) =>
          !(Array.isArray(entry) && entry[0] === "src") && entry !== "src",
      ),
      ["src", /^https?:/i],
      "alt",
      "title",
      "width",
      "height",
    ],
    // rehype-pretty-code は properties["data-language"] のように kebab-case 文字列
    // キーで書き込むため、camelCase / kebab-case 双方を allow にしてマッチ漏れを防ぐ。
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      "className",
      "dataLanguage",
      "data-language",
      "dataTheme",
      "data-theme",
      "style",
    ],
    pre: [
      ...(defaultSchema.attributes?.pre ?? []),
      "className",
      "dataLanguage",
      "data-language",
      "dataTheme",
      "data-theme",
      "style",
      "tabIndex",
    ],
    figure: [
      "className",
      "dataRehypePrettyCodeFigure",
      "data-rehype-pretty-code-figure",
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      "className",
      "style",
      "dataLine",
      "data-line",
      "dataHighlightedLine",
      "data-highlighted-line",
      "dataHighlightedChars",
      "data-highlighted-chars",
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      "className",
      "dataRehypePrettyCodeTitle",
      "data-rehype-pretty-code-title",
    ],
  },
} as const);

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypePrettyCode, {
    theme: "github-dark-dimmed",
    keepBackground: true,
  })
  // biome-ignore lint/suspicious/noExplicitAny: rehype-sanitize Schema は深い frozen の型推論で any 互換が必要
  .use(rehypeSanitize, SAFE_SCHEMA as any)
  .use(rehypeStringify);

export async function renderMarkdownToSafeHtml(md: string): Promise<string> {
  const file = await processor.process(md);
  return String(file);
}
