import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { handleCallback } from "../handler";

const baseUrl = "http://localhost:3000";

describe("auth callback handler", () => {
  it("redirects to /login?error=unauthorized when exchange fails", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/auth/callback?code=abc`);
    const exchangeCodeForSession = vi
      .fn()
      .mockResolvedValue({ error: { message: "not allowed" } });

    // Act
    const result = await handleCallback({
      request,
      exchangeCodeForSession,
    });

    // Assert
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(
      `${baseUrl}/login?error=unauthorized`,
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("redirects to / on successful exchange", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/auth/callback?code=ok`);
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    // Act
    const result = await handleCallback({
      request,
      exchangeCodeForSession,
    });

    // Assert
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(`${baseUrl}/`);
  });

  it("redirects to /login?error=unauthorized when code param is missing", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/auth/callback`);
    const exchangeCodeForSession = vi.fn();

    // Act
    const result = await handleCallback({
      request,
      exchangeCodeForSession,
    });

    // Assert
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(
      `${baseUrl}/login?error=unauthorized`,
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
