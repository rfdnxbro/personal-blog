import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { handleLogout } from "./handler";

const baseUrl = "http://localhost:3000";

describe("logout handler", () => {
  it("returns 403 when Origin header does not match site URL", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/logout`, {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
    });
    const signOut = vi.fn();

    // Act
    const result = await handleLogout({
      request,
      signOut,
      allowedOrigins: [baseUrl],
    });

    // Assert
    expect(result.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("returns 403 when Origin header is missing", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/logout`, { method: "POST" });
    const signOut = vi.fn();

    // Act
    const result = await handleLogout({
      request,
      signOut,
      allowedOrigins: [baseUrl],
    });

    // Assert
    expect(result.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out and redirects to / on matching Origin", async () => {
    // Arrange
    const request = new NextRequest(`${baseUrl}/logout`, {
      method: "POST",
      headers: { origin: baseUrl },
    });
    const signOut = vi.fn().mockResolvedValue(undefined);

    // Act
    const result = await handleLogout({
      request,
      signOut,
      allowedOrigins: [baseUrl],
    });

    // Assert
    expect(result.status).toBe(303);
    expect(result.headers.get("location")).toBe(`${baseUrl}/`);
    expect(signOut).toHaveBeenCalledOnce();
  });
});
