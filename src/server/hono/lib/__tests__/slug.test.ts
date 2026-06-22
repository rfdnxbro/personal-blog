import { describe, expect, it } from "vitest";
import { slugify } from "../slug";

// posts.slug の DB check 制約 (`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`) と完全に一致させる
// (rules/api.md エラーマッピング + 0002_posts.sql)。
const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with hyphens", () => {
    // Arrange
    const input = "Hello World!!";

    // Act
    const result = slugify(input);

    // Assert
    expect(result).toBe("hello-world");
    expect(result).toMatch(SLUG_PATTERN);
  });

  it("strips leading and trailing hyphens", () => {
    // Arrange
    const input = "  hello  ";

    // Act
    const result = slugify(input);

    // Assert
    expect(result).toBe("hello");
    expect(result).toMatch(SLUG_PATTERN);
  });

  it("strips trailing hyphen left by truncation at 100 chars", () => {
    // Arrange — "a-a-a-...-a-" (60 個の "a-" → 120 chars).
    // ascii 置換後の中間値は最後が `-` 終わり。トリム後 119 chars (末尾 `a`)。
    // それを 100 文字にスライスすると末尾が `-` になり、check 制約に違反していた。
    const input = "a ".repeat(60);

    // Act
    const result = slugify(input);

    // Assert
    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toMatch(SLUG_PATTERN);
    expect(result.endsWith("-")).toBe(false);
  });
});
