import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../turnstile";

// 外部 I/O (fetch) のため fetch だけモックする (rules/testing.md 「外部 I/O は vi.mock OK」)。
// turnstile.ts は **失敗系を全部 false に倒す (fail closed)** ことが仕様。
// 例外を投げないことを担保する。

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("verifyTurnstile", () => {
  it("secret 未設定なら false を返す", async () => {
    // Arrange
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    // Act
    const ok = await verifyTurnstile("any-token");

    // Assert
    expect(ok).toBe(false);
  });

  it("siteverify が success: true を返したら true", async () => {
    // Arrange
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    // Act
    const ok = await verifyTurnstile("good-token", "1.2.3.4");

    // Assert
    expect(ok).toBe(true);
  });

  it("siteverify が success: false を返したら false", async () => {
    // Arrange
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: false, "error-codes": ["invalid-input"] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );

    // Act
    const ok = await verifyTurnstile("bad-token");

    // Assert
    expect(ok).toBe(false);
  });

  it("HTTP 非 2xx は false に倒す (例外を投げない)", async () => {
    // Arrange
    globalThis.fetch = vi.fn(
      async () => new Response("server error", { status: 500 }),
    );

    // Act
    const ok = await verifyTurnstile("tok");

    // Assert
    expect(ok).toBe(false);
  });

  it("fetch が throw しても false を返す (network error → fail closed)", async () => {
    // Arrange
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    });

    // Act
    const ok = await verifyTurnstile("tok");

    // Assert
    expect(ok).toBe(false);
  });

  it("JSON parse 失敗でも false を返す", async () => {
    // Arrange
    globalThis.fetch = vi.fn(
      async () => new Response("<<not json>>", { status: 200 }),
    );

    // Act
    const ok = await verifyTurnstile("tok");

    // Assert
    expect(ok).toBe(false);
  });
});
