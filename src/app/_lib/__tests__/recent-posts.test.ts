import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRecentPublishedPosts,
  type RecentPostsLoader,
} from "../recent-posts";

describe("buildRecentPublishedPosts", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Arrange: console.error をスパイして「ログが出ているか」を assert できるようにする。
    // 副作用としてテスト出力が散らからないよう、デフォルトで no-op に差し替える。
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

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
    expect(result.error).toBeNull();
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0]).toEqual({
      id: "post-1",
      slug: "hello-world",
      title: "Hello",
      published_at: "2026-06-01T00:00:00.000Z",
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
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

  it("returns posts=[] + non-null error and logs when the loader reports an error", async () => {
    // Arrange
    const loader: RecentPostsLoader = async () => ({
      data: null,
      error: { message: "boom", code: "PGRST500" },
    });

    // Act
    const result = await buildRecentPublishedPosts(5, loader);

    // Assert
    expect(result.posts).toEqual([]);
    expect(result.error).toBe("boom");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logged = consoleErrorSpy.mock.calls[0]?.[0];
    expect(typeof logged).toBe("string");
    const parsed = JSON.parse(logged as string);
    expect(parsed).toMatchObject({
      level: "error",
      msg: "recent_posts_fetch_failed",
      code: "PGRST500",
      message: "boom",
    });
  });

  it("returns posts=[] + non-null error and logs when the loader throws", async () => {
    // Arrange
    const loader: RecentPostsLoader = async () => {
      throw new Error("network down");
    };

    // Act
    const result = await buildRecentPublishedPosts(5, loader);

    // Assert
    expect(result.posts).toEqual([]);
    expect(result.error).toBe("network down");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logged = consoleErrorSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(logged as string);
    expect(parsed).toMatchObject({
      level: "error",
      msg: "recent_posts_fetch_failed",
      code: null,
      message: "network down",
    });
  });

  it("returns posts=[] + error=null when the loader returns null data without error", async () => {
    // Arrange: error が無いのに data が null は実運用では Supabase からは起き
    // にくいが、防御的に空配列扱いし error も null のまま返す (空 UI を出す)。
    const loader: RecentPostsLoader = async () => ({
      data: null,
      error: null,
    });

    // Act
    const result = await buildRecentPublishedPosts(5, loader);

    // Assert
    expect(result.posts).toEqual([]);
    expect(result.error).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
