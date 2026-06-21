import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../../app";
import type { SessionEditor, SessionUser } from "../../middleware/session";

// Supabase client は外部 I/O 境界なのでモジュールモックする (rules/testing.md 例外条件)。
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import posts from "../posts";

type ChainStub = {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

function makeFromStub(): ChainStub {
  const stub: ChainStub = {
    insert: vi.fn().mockReturnThis() as ChainStub["insert"],
    update: vi.fn().mockReturnThis() as ChainStub["update"],
    delete: vi.fn().mockReturnThis() as ChainStub["delete"],
    select: vi.fn().mockReturnThis() as ChainStub["select"],
    eq: vi.fn().mockReturnThis() as ChainStub["eq"],
    order: vi.fn().mockReturnThis() as ChainStub["order"],
    single: vi.fn(),
  };
  return stub;
}

function makeSupabase(fromStub: ChainStub) {
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
  app.route("/posts", posts);
  return app;
}

beforeEach(() => {
  vi.mocked(createServerClient).mockReset();
});

describe("POST /posts", () => {
  it("returns 401 when not authenticated", async () => {
    // Arrange
    const app = buildApp({ user: null, editor: null });

    // Act
    const res = await app.request("/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "hello",
        content_md: "# hi",
      }),
    });

    // Assert
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not an editor (RLS forbids insert)", async () => {
    // Arrange
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: null,
    });

    // Act
    const res = await app.request("/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "hello",
        content_md: "# hi",
      }),
    });

    // Assert
    expect(res.status).toBe(403);
  });

  it("returns 200 with created post when editor inserts", async () => {
    // Arrange
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValue({
      data: {
        id: "p1",
        title: "hello",
        slug: "hello",
        content_md: "# hi",
        status: "draft",
      },
      error: null,
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: { id: "e1", role: "editor" },
    });

    // Act
    const res = await app.request("/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Hello World",
        content_md: "# hi",
      }),
    });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { slug: string };
    expect(body.slug).toBe("hello");
  });

  it("auto-generates slug from title when body.slug is omitted", async () => {
    // Arrange
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValue({
      data: { id: "p1", slug: "hello-world" },
      error: null,
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: { id: "e1", role: "editor" },
    });

    // Act
    const res = await app.request("/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Hello World!!",
        content_md: "# hi",
      }),
    });

    // Assert
    expect(res.status).toBe(200);
    const insertArg = fromStub.insert.mock.calls[0]?.[0] as { slug: string };
    expect(insertArg.slug).toBe("hello-world");
  });

  it("returns 409 on slug unique violation", async () => {
    // Arrange
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: { id: "e1", role: "editor" },
    });

    // Act
    const res = await app.request("/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Hello",
        slug: "hello",
        content_md: "# hi",
      }),
    });

    // Assert
    expect(res.status).toBe(409);
  });
});

describe("GET /posts", () => {
  it("returns published posts (RLS で絞られる前提、route は status=published を渡すだけ)", async () => {
    // Arrange
    const fromStub = makeFromStub();
    fromStub.order.mockResolvedValue({
      data: [{ id: "p1", slug: "hello", title: "Hello" }],
      error: null,
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({ user: null, editor: null });

    // Act
    const res = await app.request("/posts");

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /posts (mapDbError edge cases)", () => {
  it("returns 400 on NOT NULL violation (23502)", async () => {
    // Arrange — editor 未紐付け等で author_id が null になるケースを想定。
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValue({
      data: null,
      error: { code: "23502", message: "null value in column" },
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: null,
    });

    // Act
    const res = await app.request("/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "hello",
        content_md: "# hi",
      }),
    });

    // Assert
    expect(res.status).toBe(400);
  });
});

describe("PATCH /posts/:id", () => {
  it("returns 401 when not authenticated", async () => {
    // Arrange
    const app = buildApp({ user: null, editor: null });

    // Act
    const res = await app.request(
      "/posts/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "updated" }),
      },
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("returns 403 when RLS forbids update", async () => {
    // Arrange
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: { id: "e1", role: "editor" },
    });

    // Act
    const res = await app.request(
      "/posts/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "updated" }),
      },
    );

    // Assert
    expect(res.status).toBe(403);
  });

  it("sets published_at when status flips to published", async () => {
    // Arrange
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValue({
      data: { id: "p1", status: "published" },
      error: null,
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: { id: "e1", role: "editor" },
    });

    // Act
    const res = await app.request(
      "/posts/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      },
    );

    // Assert
    expect(res.status).toBe(200);
    const updateArg = fromStub.update.mock.calls[0]?.[0] as {
      status: string;
      published_at?: string;
    };
    expect(updateArg.status).toBe("published");
    expect(updateArg.published_at).toBeDefined();
  });

  it("does not set published_at when status stays draft", async () => {
    // Arrange
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValue({
      data: { id: "p1", status: "draft" },
      error: null,
    });
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: { id: "e1", role: "editor" },
    });

    // Act
    const res = await app.request(
      "/posts/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "still draft" }),
      },
    );

    // Assert
    expect(res.status).toBe(200);
    const updateArg = fromStub.update.mock.calls[0]?.[0] as {
      published_at?: string;
    };
    expect(updateArg.published_at).toBeUndefined();
  });
});

describe("DELETE /posts/:id", () => {
  it("returns 401 when not authenticated", async () => {
    // Arrange
    const app = buildApp({ user: null, editor: null });

    // Act
    const res = await app.request(
      "/posts/11111111-1111-4111-8111-111111111111",
      {
        method: "DELETE",
      },
    );

    // Assert
    expect(res.status).toBe(401);
  });

  it("returns 403 when RLS forbids delete", async () => {
    // Arrange — Supabase の delete chain は eq() で最終 await されるため、
    // eq の resolve 値で stub する。
    const fromStub = makeFromStub();
    fromStub.eq = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    }) as ChainStub["eq"];
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: { id: "e1", role: "editor" },
    });

    // Act
    const res = await app.request(
      "/posts/11111111-1111-4111-8111-111111111111",
      {
        method: "DELETE",
      },
    );

    // Assert
    expect(res.status).toBe(403);
  });

  it("returns 200 ok when delete succeeds", async () => {
    // Arrange
    const fromStub = makeFromStub();
    fromStub.eq = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }) as ChainStub["eq"];
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    const app = buildApp({
      user: { id: "u1", email: "u@example.com" },
      editor: { id: "e1", role: "editor" },
    });

    // Act
    const res = await app.request(
      "/posts/11111111-1111-4111-8111-111111111111",
      {
        method: "DELETE",
      },
    );

    // Assert
    expect(res.status).toBe(200);
  });
});
