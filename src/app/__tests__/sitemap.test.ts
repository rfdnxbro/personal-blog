import { describe, expect, it } from "vitest";
import { buildSitemap } from "../sitemap";

describe("buildSitemap", () => {
  it("includes the root URL and published posts", async () => {
    // Arrange
    const updatedAt = "2026-06-01T12:00:00.000Z";
    const loader = async () => ({
      data: [{ slug: "hello-world", updated_at: updatedAt }],
      error: null,
    });

    // Act
    const result = await buildSitemap(loader);

    // Assert
    expect(result.length).toBeGreaterThanOrEqual(2);

    const root = result.find((entry) => entry.url.endsWith("/"));
    expect(root).toBeDefined();

    const post = result.find((entry) =>
      entry.url.endsWith("/posts/hello-world"),
    );
    expect(post).toBeDefined();
    expect(post?.lastModified).toBeInstanceOf(Date);
  });

  it("returns only the root URL when the loader reports an error", async () => {
    // Arrange
    const loader = async () => ({
      data: null,
      error: { message: "boom" },
    });

    // Act
    const result = await buildSitemap(loader);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].url).toMatch(/\/$/);
  });

  it("returns only the root URL when the loader throws", async () => {
    // Arrange
    const loader = async () => {
      throw new Error("network down");
    };

    // Act
    const result = await buildSitemap(loader);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].url).toMatch(/\/$/);
  });
});
