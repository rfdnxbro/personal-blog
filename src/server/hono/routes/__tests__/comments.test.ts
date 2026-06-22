import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CommentsDeps, createCommentsRoute } from "../comments";

// rules/testing.md: 「@supabase/ssr 自体をモジュールモックしない」「ルート単体テストは
// 関数引数 / factory で stub を注入する」。
// routes/comments.ts は createCommentsRoute(deps) factory を export しているので、
// ここではモジュールモック (vi.mock) ではなく直接 stub オブジェクトを渡す。
// rate-limit middleware も同じ Supabase stub を共有して読む。

type InsertRecord = { table: string; values: Record<string, unknown> };
type RpcCall = { fn: string; args: Record<string, unknown> };

type State = {
  inserts: InsertRecord[];
  rpcs: RpcCall[];
  deleteCalls: { table: string; id: string }[];
  insertError: { code?: string; message?: string } | null;
  deleteError: { code?: string; message?: string } | null;
  // RLS で削除対象 0 行のシナリオを表現する (DELETE 後の select で返す配列の長さ)。
  deleteReturnedRows: number;
  rateLimitSelectCount: number;
};

function freshState(): State {
  return {
    inserts: [],
    rpcs: [],
    deleteCalls: [],
    insertError: null,
    deleteError: null,
    deleteReturnedRows: 1,
    rateLimitSelectCount: 0,
  };
}

// テスト用の薄い Supabase クライアント stub。Hono ルートと rate-limit middleware が
// 実際に呼ぶメソッド (`from(...).insert/select/delete/.eq/.gte` と `rpc`) だけを実装する。
// 型は SupabaseLike / SupabaseLikeForRateLimit に対して当てるため、any キャストで吸収する。
// biome-ignore lint/suspicious/noExplicitAny: route の薄い stub なので型を緩める
function makeSupabaseStub(state: State): any {
  return {
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
        eq: (_col: string, val: string) => ({
          select: async (_cols: string) => {
            state.deleteCalls.push({ table, id: val });
            if (state.deleteError) {
              return { data: null, error: state.deleteError };
            }
            return {
              data: Array.from({ length: state.deleteReturnedRows }).map(
                () => ({ id: val }),
              ),
              error: null,
            };
          },
        }),
      });
      return builder;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcs.push({ fn, args });
      return { data: null, error: null };
    },
  };
}

const VALID_POST_ID = "11111111-2222-4333-8444-555555555555";
const VALID_COMMENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeApp(state: State, depsOverride?: Partial<CommentsDeps>) {
  const supabase = makeSupabaseStub(state);
  const deps: CommentsDeps = {
    getSupabase: () => supabase,
    verifyTurnstile: vi.fn(async () => true),
    ...depsOverride,
  };
  return {
    app: new Hono().route("/comments", createCommentsRoute(deps)),
    deps,
  };
}

let state: State;

beforeEach(() => {
  state = freshState();
});

describe("POST /comments/:postId", () => {
  it("honeypot に値が入っていたら 200 silent drop で insert は呼ばれない", async () => {
    // Arrange
    const { app } = makeApp(state);

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
    const { app } = makeApp(state);
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
    const verifyTurnstile = vi.fn(async () => false);
    const { app } = makeApp(state, { verifyTurnstile });

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
    expect(verifyTurnstile).toHaveBeenCalledTimes(1);
    expect(state.inserts).toEqual([]);
  });

  it("rate limit を超えると 429 を返し insert されない", async () => {
    // Arrange
    state.rateLimitSelectCount = 5; // perMinute 上限 (5) に到達
    const { app } = makeApp(state);

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
    const { app } = makeApp(state);

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
    state.deleteReturnedRows = 1;
    const { app } = makeApp(state);

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

  it("RLS で 0 行に絞られた場合は 404 を返す (silent success を避ける)", async () => {
    // Arrange
    state.deleteReturnedRows = 0;
    const { app } = makeApp(state);

    // Act
    const res = await app.request(`/comments/${VALID_COMMENT_ID}`, {
      method: "DELETE",
    });

    // Assert
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  it("RLS 弾き (42501) は 403 forbidden にマッピングされる", async () => {
    // Arrange
    state.deleteError = { code: "42501", message: "permission denied" };
    const { app } = makeApp(state);

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
