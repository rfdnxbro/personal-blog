import { describe, expect, it } from "vitest";
import robots from "../robots";

describe("robots", () => {
  it("disallows /admin and points to the sitemap", () => {
    // Arrange / Act
    const result = robots();

    // Assert
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const userAgentRule = rules.find((rule) => rule.userAgent === "*");
    expect(userAgentRule).toBeDefined();

    const disallow = userAgentRule?.disallow;
    const disallows = Array.isArray(disallow)
      ? disallow
      : disallow
        ? [disallow]
        : [];
    expect(disallows).toContain("/admin/");

    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
