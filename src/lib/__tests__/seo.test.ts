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

  it("collapses consecutive whitespace and newlines into single spaces", () => {
    // Arrange
    const md = "line one\n\n\nline   two";

    // Act
    const result = extractDescription(md);

    // Assert
    expect(result).toBe("line one line two");
  });

  it("truncates output to maxLength characters", () => {
    // Arrange
    const md = "a".repeat(500);

    // Act
    const result = extractDescription(md, 160);

    // Assert
    expect(result).toHaveLength(160);
    expect(result).toBe("a".repeat(160));
  });

  it("returns empty string when input is empty", () => {
    // Arrange / Act
    const result = extractDescription("");

    // Assert
    expect(result).toBe("");
  });
});
