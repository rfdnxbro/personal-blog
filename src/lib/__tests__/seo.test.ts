import { afterEach, describe, expect, it } from "vitest";
import { buildPostMetadata } from "../seo";

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
