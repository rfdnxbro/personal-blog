import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import health from "../health";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    // Arrange
    const app = new Hono().route("/health", health);

    // Act
    const res = await app.request("/health");

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body).toEqual({ status: "ok" });
  });
});
