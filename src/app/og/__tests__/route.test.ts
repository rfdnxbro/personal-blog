import { describe, expect, it } from "vitest";
import { GET } from "../route";

describe("GET /og", () => {
  it("returns a PNG image response for a given title", async () => {
    // Arrange
    const request = new Request("http://localhost:3000/og?title=hello");

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toMatch(/image\/png/);
  });

  it("falls back to a default title when the title query param is missing", async () => {
    // Arrange
    const request = new Request("http://localhost:3000/og");

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toMatch(/image\/png/);
  });
});
