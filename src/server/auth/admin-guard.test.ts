import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { adminGuard } from "./admin-guard";

const baseUrl = "http://localhost:3000";

describe("adminGuard", () => {
  it("redirects to /login when accessing /admin without a user", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/admin/dashboard`);
    const response = NextResponse.next();
    const fetchEditor = vi.fn();

    // Act
    const result = await adminGuard({
      request,
      response,
      user: null,
      fetchEditor,
    });

    // Assert
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(`${baseUrl}/login`);
    expect(fetchEditor).not.toHaveBeenCalled();
  });

  it("redirects to /login when user is signed in but has no editor row", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/admin/posts`);
    const response = NextResponse.next();
    const fetchEditor = vi.fn().mockResolvedValue(null);

    // Act
    const result = await adminGuard({
      request,
      response,
      user: { id: "user-1", email: "x@example.com" },
      fetchEditor,
    });

    // Assert
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(`${baseUrl}/login`);
    expect(fetchEditor).toHaveBeenCalledWith("user-1");
  });

  it("passes through when editor row exists for /admin path", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/admin/posts`);
    const response = NextResponse.next();
    const fetchEditor = vi
      .fn()
      .mockResolvedValue({ id: "editor-1", role: "editor" as const });

    // Act
    const result = await adminGuard({
      request,
      response,
      user: { id: "user-1", email: "x@example.com" },
      fetchEditor,
    });

    // Assert
    expect(result).toBe(response);
    expect(fetchEditor).toHaveBeenCalledWith("user-1");
  });

  it("skips editor check on non-admin paths even when user is null", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/posts/hello`);
    const response = NextResponse.next();
    const fetchEditor = vi.fn();

    // Act
    const result = await adminGuard({
      request,
      response,
      user: null,
      fetchEditor,
    });

    // Assert
    expect(result).toBe(response);
    expect(fetchEditor).not.toHaveBeenCalled();
  });

  it("guards /api/admin path the same way as /admin", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/api/admin/posts`);
    const response = NextResponse.next();
    const fetchEditor = vi.fn().mockResolvedValue(null);

    // Act
    const result = await adminGuard({
      request,
      response,
      user: { id: "user-1", email: "x@example.com" },
      fetchEditor,
    });

    // Assert
    expect(result.status).toBe(307);
    expect(result.headers.get("location")).toBe(`${baseUrl}/login`);
  });
});
