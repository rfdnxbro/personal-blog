import { describe, expect, it } from "vitest";
import {
  buildRecentPublishedPosts,
  type RecentPostsLoader,
} from "../recent-posts";

describe("buildRecentPublishedPosts", () => {
  it("returns the rows returned by the loader", async () => {
    // Arrange
    const loader: RecentPostsLoader = async (limit) => ({
      data: [
        {
          id: "post-1",
          slug: "hello-world",
          title: "Hello",
          published_at: "2026-06-01T00:00:00.000Z",
        },
        {
          id: "post-2",
          slug: "second-post",
          title: "Second",
          published_at: "2026-05-20T00:00:00.000Z",
        },
      ].slice(0, limit),
      error: null,
    });

    // Act
    const result = await buildRecentPublishedPosts(5, loader);

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "post-1",
      slug: "hello-world",
      title: "Hello",
      published_at: "2026-06-01T00:00:00.000Z",
    });
  });

  it("passes the requested limit to the loader", async () => {
    // Arrange
    let receivedLimit: number | null = null;
    const loader: RecentPostsLoader = async (limit) => {
      receivedLimit = limit;
      return { data: [], error: null };
    };

    // Act
    await buildRecentPublishedPosts(3, loader);

    // Assert
    expect(receivedLimit).toBe(3);
  });

  it("returns an empty array when the loader reports an error", async () => {
    // Arrange
    const loader: RecentPostsLoader = async () => ({
      data: null,
      error: { message: "boom" },
    });

    // Act
    const result = await buildRecentPublishedPosts(5, loader);

    // Assert
    expect(result).toEqual([]);
  });

  it("returns an empty array when the loader throws", async () => {
    // Arrange
    const loader: RecentPostsLoader = async () => {
      throw new Error("network down");
    };

    // Act
    const result = await buildRecentPublishedPosts(5, loader);

    // Assert
    expect(result).toEqual([]);
  });

  it("returns an empty array when the loader returns null data", async () => {
    // Arrange
    const loader: RecentPostsLoader = async () => ({
      data: null,
      error: null,
    });

    // Act
    const result = await buildRecentPublishedPosts(5, loader);

    // Assert
    expect(result).toEqual([]);
  });
});
