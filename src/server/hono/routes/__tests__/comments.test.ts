import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase クライアント (createServerClient) と Turnstile siteverify は外部 I/O のため
// モジュールモックする (rules/testing.md 「外部 I/O は vi.mock OK」)。
// テストごとに振る舞いを差し替えやすいよう builder スタイルの stub を用意。

type InsertRecord = {
  table: string;
  values: Record<string, unknown>;
};

type RpcCall = { fn: string; args: Record<string, unknown> };

// 1 テスト 1 stub state。describe 直下で共有して各テストの it 内で書き換える。
const state = {
  inserts: [] as InsertRecord[],
  rpcs: [] as RpcCall[],
  deleteCalls: [] as { table: string; id: string }[],
  insertError: null as { code?: string; message?: string } | null,
  deleteError: null as { code?: string; message?: string } | null,
  rateLimitSelectCount: 0,
};

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      builder.insert = (values: Record<string, unknown>) => {
        state.inserts.push({ table, values });
        return {
          select: () => ({
            single: async () =>
              state.insertError
                ? { data: null, error: state.insertError }
                : {
                    data: {
                      id: "11111111-1111-1111-1111-111111111111",
                      ...values,
                      created_at: "2025-01-01T00:00:00.000Z",
                    },
                    error: null,
                  },
          }),
        };
      };
      builder.select = (_cols: string) => {
        const chain: Record<string, unknown> = {};
        chain.eq = (_col: string, _val: unknown) => chain;
        chain.gte = (_col: string, _val: unknown) =>
          Promise.resolve({
            data: Array.from({ length: state.rateLimitSelectCount }).map(
              () => ({ count: 1 }),
            ),
            error: null,
          });
        return chain;
      };
      builder.delete = () => ({
        eq: async (_col: string, val: string) => {
          state.deleteCalls.push({ table, id: val });
          return state.deleteError
            ? { error: state.deleteError }
            : { error: null };
        },
      });
      return builder;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcs.push({ fn, args });
      return { data: null, error: null };
    },
  }),
}));

vi.mock("../../lib/turnstile", () => ({
  verifyTurnstile: vi.fn(async () => true),
}));

import { verifyTurnstile } from "../../lib/turnstile";
import comments from "../comments";

const VALID_POST_ID = "11111111-2222-4333-8444-555555555555";
const VALID_COMMENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeApp() {
  return new Hono().route("/comments", comments);
}

beforeEach(() => {
  state.inserts = [];
  state.rpcs = [];
  state.deleteCalls = [];
  state.insertError = null;
  state.deleteError = null;
  state.rateLimitSelectCount = 0;
  vi.mocked(verifyTurnstile).mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /comments/:postId", () => {
  it("honeypot に値が入っていたら 200 silent drop で insert は呼ばれない", async () => {
    // Arrange
    const app = makeApp();

    // Act
    const res = await app.request(`/comments/${VALID_POST_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_name: "spammer",
        body: "hi",
        turnstileToken: "tok",
        website: "https://spam.example.com",
      }),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(state.inserts).toEqual([]);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("URL を 3 個以上含むと 400 を返し insert されない", async () => {
    // Arrange
    const app = makeApp();
    const bodyText =
      "see http://a.example http://b.example http://c.example for details";

    // Act
    const res = await app.request(`/comments/${VALID_POST_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_name: "alice",
        body: bodyText,
        turnstileToken: "tok",
      }),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(state.inserts).toEqual([]);
  });

  it("Turnstile siteverify が失敗したら 400 を返し insert されない", async () => {
    // Arrange
    vi.mocked(verifyTurnstile).mockResolvedValueOnce(false);
    const app = makeApp();

    // Act
    const res = await app.request(`/comments/${VALID_POST_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_name: "alice",
        body: "nice post",
        turnstileToken: "bad-token",
      }),
    });

    // Assert
    expect(res.status).toBe(400);
    expect(state.inserts).toEqual([]);
  });

  it("rate limit を超えると 429 を返し insert されない", async () => {
    // Arrange
    state.rateLimitSelectCount = 5; // perMinute 上限 (5) に到達
    const app = makeApp();

    // Act
    const res = await app.request(`/comments/${VALID_POST_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_name: "alice",
        body: "nice post",
        turnstileToken: "tok",
      }),
    });

    // Assert
    expect(res.status).toBe(429);
    expect(state.inserts).toEqual([]);
  });

  it("正常系: 201 で comments に insert される", async () => {
    // Arrange
    const app = makeApp();

    // Act
    const res = await app.request(`/comments/${VALID_POST_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author_name: "alice",
        body: "great post!",
        turnstileToken: "tok",
      }),
    });

    // Assert
    expect(res.status).toBe(201);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]?.table).toBe("comments");
    expect(state.inserts[0]?.values).toMatchObject({
      post_id: VALID_POST_ID,
      author_name: "alice",
      body: "great post!",
    });
  });
});

describe("DELETE /comments/:id", () => {
  it("delete を呼んで 204 を返す (認可は RLS が一次源)", async () => {
    // Arrange
    const app = makeApp();

    // Act
    const res = await app.request(`/comments/${VALID_COMMENT_ID}`, {
      method: "DELETE",
    });

    // Assert
    expect(res.status).toBe(204);
    expect(state.deleteCalls).toEqual([
      { table: "comments", id: VALID_COMMENT_ID },
    ]);
  });

  it("RLS 弾き (42501) は 403 forbidden にマッピングされる", async () => {
    // Arrange
    state.deleteError = { code: "42501", message: "permission denied" };
    const app = makeApp();

    // Act
    const res = await app.request(`/comments/${VALID_COMMENT_ID}`, {
      method: "DELETE",
    });

    // Assert
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("forbidden");
  });
});
