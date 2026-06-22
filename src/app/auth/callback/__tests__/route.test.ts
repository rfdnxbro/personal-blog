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

  it("redirects to next param on successful exchange when next is a safe local path", async () => {
    // Arrange
    const next = encodeURIComponent("/admin/posts");
    const request = new NextRequest(
      `${baseUrl}/auth/callback?code=ok&next=${next}`,
    );
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    // Act
    const result = await handleCallback({
      request,
      exchangeCodeForSession,
    });

    // Assert
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(`${baseUrl}/admin/posts`);
  });

  it("preserves next path query string on successful exchange", async () => {
    // Arrange
    const next = encodeURIComponent("/admin/posts?page=2");
    const request = new NextRequest(
      `${baseUrl}/auth/callback?code=ok&next=${next}`,
    );
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    // Act
    const result = await handleCallback({
      request,
      exchangeCodeForSession,
    });

    // Assert
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(
      `${baseUrl}/admin/posts?page=2`,
    );
  });

  it("ignores next param that is a protocol-relative URL (open redirect guard)", async () => {
    // Arrange
    const next = encodeURIComponent("//evil.example.com/steal");
    const request = new NextRequest(
      `${baseUrl}/auth/callback?code=ok&next=${next}`,
    );
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

  it("ignores next param that is an absolute external URL", async () => {
    // Arrange
    const next = encodeURIComponent("https://evil.example.com/phish");
    const request = new NextRequest(
      `${baseUrl}/auth/callback?code=ok&next=${next}`,
    );
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

  it("ignores next param that does not start with a slash", async () => {
    // Arrange
    const next = encodeURIComponent("admin/posts");
    const request = new NextRequest(
      `${baseUrl}/auth/callback?code=ok&next=${next}`,
    );
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

  it("ignores next param when exchange fails (does not leak deep link to /login)", async () => {
    // Arrange
    const next = encodeURIComponent("/admin/posts");
    const request = new NextRequest(
      `${baseUrl}/auth/callback?code=abc&next=${next}`,
    );
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
  });
});
