import { afterEach, describe, expect, it, vi } from "vitest";

const createServerClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("sitemap", () => {
  it("includes the root URL and published posts", async () => {
    // Arrange
    const updatedAt = "2026-06-01T12:00:00.000Z";
    createServerClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [{ slug: "hello-world", updated_at: updatedAt }],
              error: null,
            }),
        }),
      }),
    });

    // Act
    const sitemap = (await import("../sitemap")).default;
    const result = await sitemap();

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

  it("returns only the root URL when Supabase errors", async () => {
    // Arrange
    createServerClientMock.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: { message: "boom" } }),
        }),
      }),
    });

    // Act
    const sitemap = (await import("../sitemap")).default;
    const result = await sitemap();

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].url).toMatch(/\/$/);
  });
});
