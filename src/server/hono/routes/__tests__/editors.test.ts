import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../app";
import type { SessionEditor, SessionUser } from "../../middleware/session";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import editors from "../editors";

type EditorsFromStub = {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
};

function makeEditorsFromStub(): EditorsFromStub {
  const stub: EditorsFromStub = {
    insert: vi.fn().mockReturnThis() as EditorsFromStub["insert"],
    select: vi.fn().mockReturnThis() as EditorsFromStub["select"],
    single: vi.fn(),
    delete: vi.fn().mockReturnThis() as EditorsFromStub["delete"],
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return stub;
}

function makeAuthenticatedSupabase(fromStub: EditorsFromStub) {
  return {
    from: vi.fn().mockReturnValue(fromStub),
  };
}

function buildApp(opts: {
  user?: SessionUser | null;
  editor?: SessionEditor | null;
}) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("user", opts.user ?? null);
    c.set("editor", opts.editor ?? null);
    await next();
  });
  app.route("/editors", editors);
  return app;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServerClient).mockReset();
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
});

describe("POST /editors/invite", () => {
  it("returns 401 when not authenticated", async () => {
    // Arrange
    const app = buildApp({ user: null, editor: null });

    // Act
    const res = await app.request("/editors/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        role: "editor",
        display_name: "New",
      }),
    });

    // Assert
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not admin", async () => {
    // Arrange
    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: { id: "e1", role: "editor" },
    });

    // Act
    const res = await app.request("/editors/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        role: "editor",
        display_name: "New",
      }),
    });

    // Assert
    expect(res.status).toBe(403);
  });

  it("inserts editors row first, then invites via secret key", async () => {
    // Arrange
    const fromStub = makeEditorsFromStub();
    fromStub.single.mockResolvedValue({
      data: {
        id: "e2",
        email: "new@example.com",
        role: "editor",
        display_name: "New",
      },
      error: null,
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeAuthenticatedSupabase(fromStub) as any,
    );

    const inviteByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: "new-uid" } },
      error: null,
    });
    const adminClient = {
      auth: { admin: { inviteUserByEmail: inviteByEmail } },
    };
    // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
    vi.mocked(createClient).mockReturnValue(adminClient as any);

    const app = buildApp({
      user: { id: "u1", email: "admin@example.com" },
      editor: { id: "e1", role: "admin" },
    });

    // Act
    const res = await app.request("/editors/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        role: "editor",
        display_name: "New",
      }),
    });

    // Assert
    expect(res.status).toBe(200);
    expect(fromStub.insert).toHaveBeenCalledWith({
      email: "new@example.com",
      role: "editor",
      display_name: "New",
    });
    expect(inviteByEmail).toHaveBeenCalledWith("new@example.com");
  });

  it("rolls back editors row when invite fails", async () => {
    // Arrange
    const fromStub = makeEditorsFromStub();
    fromStub.single.mockResolvedValue({
      data: {
        id: "e2",
        email: "new@example.com",
        role: "editor",
        display_name: "New",
      },
      error: null,
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeAuthenticatedSupabase(fromStub) as any,
    );

    const inviteByEmail = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "invite quota exceeded" },
    });
    const adminClient = {
      auth: { admin: { inviteUserByEmail: inviteByEmail } },
    };
    // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
    vi.mocked(createClient).mockReturnValue(adminClient as any);

    const app = buildApp({
      user: { id: "u1", email: "admin@example.com" },
      editor: { id: "e1", role: "admin" },
    });

    // Act
    const res = await app.request("/editors/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        role: "editor",
        display_name: "New",
      }),
    });

    // Assert
    expect(res.status).toBe(500);
    expect(fromStub.delete).toHaveBeenCalled();
    expect(fromStub.eq).toHaveBeenCalledWith("id", "e2");
  });

  it("logs structured error when rollback delete fails (does not silently swallow)", async () => {
    // Arrange — invite が失敗 → rollback delete も失敗するケース。
    // rollback の error は silently swallow せず構造化ログで残すのが期待動作。
    const fromStub = makeEditorsFromStub();
    fromStub.single.mockResolvedValue({
      data: {
        id: "e2",
        email: "new@example.com",
        role: "editor",
        display_name: "New",
      },
      error: null,
    });
    fromStub.eq = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "rollback rls denied" },
    }) as EditorsFromStub["eq"];
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeAuthenticatedSupabase(fromStub) as any,
    );

    const inviteByEmail = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "invite quota exceeded" },
    });
    const adminClient = {
      auth: { admin: { inviteUserByEmail: inviteByEmail } },
    };
    // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
    vi.mocked(createClient).mockReturnValue(adminClient as any);

    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const app = buildApp({
      user: { id: "u1", email: "admin@example.com" },
      editor: { id: "e1", role: "admin" },
    });

    // Act
    const res = await app.request("/editors/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        role: "editor",
        display_name: "New",
      }),
    });

    // Assert — API レスポンスは invite エラー由来の 500 を返し続けるが、
    // rollback の失敗は構造化ログで追えるようになっている。
    expect(res.status).toBe(500);
    expect(consoleSpy).toHaveBeenCalled();
    const logged = consoleSpy.mock.calls[0]?.[0];
    expect(logged).toMatchObject({
      level: "error",
      msg: "editor_rollback_failed",
      editor_id: "e2",
      code: "42501",
    });

    consoleSpy.mockRestore();
  });
});
