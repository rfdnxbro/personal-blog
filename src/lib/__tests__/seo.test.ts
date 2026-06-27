import { afterEach, describe, expect, it } from "vitest";
import { buildPostMetadata, extractDescription } from "../seo";

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (ORIGINAL_SITE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
  }
});

describe("buildPostMetadata", () => {
  it("returns metadata with canonical and OG tags for a post", () => {
    // Arrange
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";

    // Act
    const metadata = buildPostMetadata({
      title: "Hello",
      description: "world",
      slug: "hello",
    });

    // Assert
    expect(metadata.title).toBe("Hello");
    expect(metadata.description).toBe("world");
    expect(metadata.alternates?.canonical).toBe(
      "https://example.test/posts/hello",
    );

    const og = metadata.openGraph;
    expect(og?.title).toBe("Hello");
    expect(og?.url).toBe("https://example.test/posts/hello");
    const images = Array.isArray(og?.images) ? og?.images : [og?.images];
    const firstImage = images?.[0];
    const imageUrl =
      typeof firstImage === "string"
        ? firstImage
        : (firstImage as { url?: string })?.url;
    expect(imageUrl).toMatch(/\/og\?title=Hello/);
  });

  it("falls back to localhost when NEXT_PUBLIC_SITE_URL is unset", () => {
    // Arrange
    delete process.env.NEXT_PUBLIC_SITE_URL;

    // Act
    const metadata = buildPostMetadata({
      title: "Untitled",
      description: "",
      slug: "draft",
    });

    // Assert
    expect(metadata.alternates?.canonical).toBe(
      "http://localhost:3000/posts/draft",
    );
  });
});

describe("extractDescription", () => {
  it("returns plain text unchanged when within max length", () => {
    // Arrange
    const md = "This is a simple description.";

    // Act
    const result = extractDescription(md);

    // Assert
    expect(result).toBe("This is a simple description.");
  });

  it("strips markdown markers from headings, quotes, and lists", () => {
    // Arrange
    const md = "# Heading\n> quoted\n- list item\n* bullet\n1. numbered";

    // Act
    const result = extractDescription(md);

    // Assert
    expect(result).toBe("Heading quoted list item bullet numbered");
  });

  it("removes fenced code blocks", () => {
    // Arrange
    const md = "Intro text\n```ts\nconst x = 1;\n```\nOutro text";

    // Act
    const result = extractDescription(md);

    // Assert
    expect(result).toBe("Intro text Outro text");
  });

  it("removes tilde fenced code blocks", () => {
    // Arrange
    const md = "Intro text\n~~~ts\nconst x = 1;\n~~~\nOutro text";

    // Act
    const result = extractDescription(md);

    // Assert
    expect(result).toBe("Intro text Outro text");
  });

  it("collapses consecutive whitespace and newlines into single spaces", () => {
    // Arrange
    const md = "line one\n\n\nline   two";

    // Act
    const result = extractDescription(md);

    // Assert
    expect(result).toBe("line one line two");
  });

  it("strips inline emphasis, code, link, and image markers", () => {
    // Arrange
    const md =
      "See **bold** and *italic* and __strong__ and _em_ and ~~strike~~ and `code` plus [link text](https://example.test) and ![alt text](https://example.test/img.png).";

    // Act
    const result = extractDescription(md);

    // Assert
    expect(result).toBe(
      "See bold and italic and strong and em and strike and code plus link text and alt text.",
    );
  });

  it("appends ellipsis when truncating", () => {
    // Arrange
    const md = "a".repeat(500);

    // Act
    const result = extractDescription(md, 160);

    // Assert
    // Array.from で codepoint 単位に分割した長さは 160 + 末尾の "…" 1 文字。
    expect(Array.from(result)).toHaveLength(161);
    expect(result.endsWith("…")).toBe(true);
    expect(result.startsWith("a".repeat(160))).toBe(true);
  });

  it("does not split surrogate pairs when truncating", () => {
    // Arrange — 絵文字 (サロゲートペア) を maxLength の境界に置く。
    const md = "🎉".repeat(200);

    // Act
    const result = extractDescription(md, 10);

    // Assert
    // codepoint ベースで 10 文字分の絵文字 + 末尾 "…" になる。
    // .length (UTF-16 code unit) で 21 = 10 emoji * 2 surrogates + 1 ellipsis。
    expect(result.length).toBe(21);
    expect(Array.from(result)).toHaveLength(11);
    expect(result.endsWith("…")).toBe(true);
    // 不正なサロゲートペア (lone surrogate) が混入していないことを確認。
    expect(result).toBe(`${"🎉".repeat(10)}…`);
  });

  it("returns empty string when input is empty", () => {
    // Arrange / Act
    const result = extractDescription("");

    // Assert
    expect(result).toBe("");
  });
});
