import { describe, expect, it } from "vitest";
import { renderMarkdownToSafeHtml } from "./markdown";

describe("renderMarkdownToSafeHtml — XSS ゴールデン", () => {
  it("strips <script> tag", async () => {
    // Arrange
    const md = "Hello <script>alert(1)</script> world";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    // `<script>` タグ自体が剥がれれば XSS にならない (中身はテキストノードとしてエスケープされる)
    expect(html).not.toMatch(/<script/i);
  });

  it("strips javascript: href", async () => {
    // Arrange
    const md = "[click](javascript:alert(1))";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).not.toMatch(/javascript:/i);
  });

  it("strips data:text/html href", async () => {
    // Arrange
    const md = "[click](data:text/html,<script>alert(1)</script>)";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).not.toMatch(/data:/i);
    expect(html).not.toMatch(/<script/i);
  });

  it("strips <img onerror>", async () => {
    // Arrange
    const md = '<img src=x onerror="alert(1)">';

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/alert\(1\)/);
  });

  it("strips <svg onload>", async () => {
    // Arrange
    const md = '<svg onload="alert(1)"></svg>';

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).not.toMatch(/onload/i);
    expect(html).not.toMatch(/alert\(1\)/);
  });

  it("strips <iframe> with javascript: src", async () => {
    // Arrange
    const md = '<iframe src="javascript:alert(1)"></iframe>';

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).not.toMatch(/<iframe/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it("strips event handlers in raw html", async () => {
    // Arrange
    const md = '<a href="http://example.com" onclick="alert(1)">click</a>';

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).not.toMatch(/onclick/i);
    expect(html).not.toMatch(/alert\(1\)/);
  });

  it("strips <img src> with javascript: scheme", async () => {
    // Arrange
    const md = "![alt](javascript:alert(1))";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).not.toMatch(/javascript:/i);
  });
});

describe("renderMarkdownToSafeHtml — 許可されるべき挙動", () => {
  it("keeps http link", async () => {
    // Arrange
    const md = "[example](http://example.com)";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).toMatch(/href="http:\/\/example\.com"/);
  });

  it("keeps https link", async () => {
    // Arrange
    const md = "[example](https://example.com)";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).toMatch(/href="https:\/\/example\.com"/);
  });

  it("keeps mailto link", async () => {
    // Arrange
    const md = "[mail](mailto:me@example.com)";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).toMatch(/href="mailto:me@example\.com"/);
  });

  it("renders gfm tables", async () => {
    // Arrange
    const md = "| a | b |\n|---|---|\n| 1 | 2 |";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).toMatch(/<table/);
    expect(html).toMatch(/<th[^>]*>a<\/th>/);
  });
});

describe("renderMarkdownToSafeHtml — コードハイライト属性保持", () => {
  it("retains data-language attribute on TypeScript code blocks", async () => {
    // Arrange
    const md = "```ts\nconst x = 1\n```";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).toMatch(/data-language="ts"/);
  });

  it("retains <pre> wrapper for fenced code", async () => {
    // Arrange
    const md = "```js\nconsole.log('hi')\n```";

    // Act
    const html = await renderMarkdownToSafeHtml(md);

    // Assert
    expect(html).toMatch(/<pre/);
    expect(html).toMatch(/<code/);
  });
});
