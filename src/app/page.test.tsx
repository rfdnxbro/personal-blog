import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// fetchRecentPublishedPosts は `server-only` を import するため、
// テスト時にスタブして Server Component が返す JSX のみを確認する。
vi.mock("./_lib/recent-posts", () => ({
  fetchRecentPublishedPosts: vi.fn(async () => [
    {
      id: "post-1",
      slug: "hello-world",
      title: "Hello world",
      published_at: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "post-2",
      slug: "second",
      title: "Second post",
      published_at: null,
    },
  ]),
}));

import Page from "./page";

describe("Page", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the site hero heading", async () => {
    // Arrange / Act
    const ui = await Page();
    render(ui);

    // Assert
    expect(screen.getByRole("heading", { name: "blog" })).toBeTruthy();
  });

  it("lists recent published posts with links", async () => {
    // Arrange / Act
    const ui = await Page();
    render(ui);

    // Assert
    const helloLink = screen.getByRole("link", {
      name: "Hello world",
    }) as HTMLAnchorElement;
    expect(helloLink.getAttribute("href")).toBe("/posts/hello-world");

    const secondLink = screen.getByRole("link", {
      name: "Second post",
    }) as HTMLAnchorElement;
    expect(secondLink.getAttribute("href")).toBe("/posts/second");
  });

  it("shows the 'more posts' link to /posts", async () => {
    // Arrange / Act
    const ui = await Page();
    render(ui);

    // Assert
    const more = screen.getByRole("link", {
      name: /もっと見る/,
    }) as HTMLAnchorElement;
    expect(more.getAttribute("href")).toBe("/posts");
  });

  it("renders an empty-state message when there are no posts", async () => {
    // Arrange
    const mod = await import("./_lib/recent-posts");
    vi.mocked(mod.fetchRecentPublishedPosts).mockResolvedValueOnce([]);

    // Act
    const ui = await Page();
    render(ui);

    // Assert
    expect(screen.getByText(/まだ記事はありません/)).toBeTruthy();
  });
});
