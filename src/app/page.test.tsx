// vi.mock は Vitest プラグインが import より上に hoist するが、Biome の
// organizeImports や将来の vitest 改修で並びが崩れて壊れやすいので、
// ファイル先頭にまとめて並べておく。
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_lib/recent-posts", () => ({
  fetchRecentPublishedPosts: vi.fn(),
}));

import { fetchRecentPublishedPosts } from "./_lib/recent-posts";
import Page from "./page";

const samplePosts = [
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
];

describe("Page", () => {
  beforeEach(() => {
    // 既定で「正常系: 2 件返る」を全 it に提供する。各 it は
    // mockResolvedValueOnce で必要に応じて上書きする。order independence を
    // 保つため mockResolvedValueOnce のスタックに依存しない。
    vi.mocked(fetchRecentPublishedPosts).mockReset();
    vi.mocked(fetchRecentPublishedPosts).mockResolvedValue({
      posts: samplePosts,
      error: null,
    });
  });

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
    vi.mocked(fetchRecentPublishedPosts).mockResolvedValueOnce({
      posts: [],
      error: null,
    });

    // Act
    const ui = await Page();
    render(ui);

    // Assert
    expect(screen.getByText(/まだ記事はありません/)).toBeTruthy();
  });

  it("renders an error-state message distinct from the empty state when fetch fails", async () => {
    // Arrange
    vi.mocked(fetchRecentPublishedPosts).mockResolvedValueOnce({
      posts: [],
      error: "boom",
    });

    // Act
    const ui = await Page();
    render(ui);

    // Assert
    expect(screen.getByText(/最新記事の取得に失敗しました/)).toBeTruthy();
    expect(screen.queryByText(/まだ記事はありません/)).toBeNull();
  });

  it("uses <main> as the page landmark (layout already provides header/footer)", async () => {
    // Arrange / Act
    const ui = await Page();
    const { container } = render(ui);

    // Assert: page.tsx 自体が <main> を返すこと (layout は <div> に下げた)。
    // 二重 <main> 防止と HTML5/ARIA landmark 維持の回帰テスト。
    expect(container.querySelector("main")).not.toBeNull();
  });
});
