import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../app";
import type { SessionEditor, SessionUser } from "../../middleware/session";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import editors from "../editors";

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

  it("returns 200 when admin invites new editor", async () => {
    // Arrange
    const inviteByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: "new-uid" } },
      error: null,
    });
    const fromStub = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "e2",
          email: "new@example.com",
          role: "editor",
          display_name: "New",
        },
        error: null,
      }),
    };
    const stubClient = {
      auth: { admin: { inviteUserByEmail: inviteByEmail } },
      from: vi.fn().mockReturnValue(fromStub),
    };
    // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
    vi.mocked(createClient).mockReturnValue(stubClient as any);

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
    expect(inviteByEmail).toHaveBeenCalledWith("new@example.com");
  });
});
