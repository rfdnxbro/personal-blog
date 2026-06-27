import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Server Action 内部の Next 副作用を無効化する。
// - revalidatePath: 副作用 dispatch を行うだけなので no-op で良い。
// - redirect: Next の実装は throw して flow を止めるので、テストでは何もしない
//   関数として差し替え、結果として action は throw せず return する形にする。
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Server Action は cookies() を経由して Supabase session cookie を Hono route に
// 横流しする。Next ランタイムに依存するためモジュールモックで差し替える。
// Origin は (Round 1 fix) 環境変数から固定的に解決するため、headers() は使わない。
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { getAllowedOrigins } from "@/server/hono/middleware/csrf";
import { inviteEditorAction } from "../_actions";

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

function setupCookies(opts?: {
  cookieList?: Array<{ name: string; value: string }>;
}) {
  const cookieList = opts?.cookieList ?? [
    { name: "sb-access-token", value: "tok" },
    { name: "sb-refresh-token", value: "ref" },
  ];

  vi.mocked(cookies).mockResolvedValue({
    getAll: vi.fn().mockReturnValue(cookieList),
    // biome-ignore lint/suspicious/noExplicitAny: Next の ReadonlyRequestCookies を満たすための stub
  } as any);
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.mocked(cookies).mockReset();
  // global.fetch は test ごとに差し替える前提。reset しておく。
  vi.restoreAllMocks();
  // env は test ごとに上書きされるので、毎回元に戻す。
  process.env = { ...originalEnv };
  // 既定値はリセット (各 test で必要に応じて再 set する)。
  process.env.NEXT_PUBLIC_SITE_URL = undefined;
  process.env.VERCEL_URL = undefined;
  process.env.PORT = undefined;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("inviteEditorAction (Server Action)", () => {
  it("throws when email is not a valid email address", async () => {
    // Arrange
    setupCookies();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    // Act + Assert
    await expect(
      inviteEditorAction(
        makeFormData({
          email: "not-an-email",
          role: "editor",
          display_name: "New",
        }),
      ),
    ).rejects.toThrow(/invalid/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws when role is not admin/editor", async () => {
    // Arrange
    setupCookies();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    // Act + Assert
    await expect(
      inviteEditorAction(
        makeFormData({
          email: "new@example.com",
          role: "viewer",
          display_name: "New",
        }),
      ),
    ).rejects.toThrow(/invalid/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws when display_name is empty", async () => {
    // Arrange
    setupCookies();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    // Act + Assert
    await expect(
      inviteEditorAction(
        makeFormData({
          email: "new@example.com",
          role: "editor",
          display_name: "",
        }),
      ),
    ).rejects.toThrow(/invalid/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts JSON to /api/editors/invite with Cookie + Origin headers and parsed body (NEXT_PUBLIC_SITE_URL)", async () => {
    // Arrange — 本番想定。Origin は NEXT_PUBLIC_SITE_URL から解決する。
    process.env.NEXT_PUBLIC_SITE_URL = "https://blog.example.com";
    setupCookies({
      cookieList: [
        { name: "sb-access-token", value: "atok" },
        { name: "sb-refresh-token", value: "rtok" },
      ],
    });
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "e2", email: "new@example.com" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Act
    await inviteEditorAction(
      makeFormData({
        email: "new@example.com",
        role: "editor",
        display_name: "New Editor",
      }),
    );

    // Assert
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://blog.example.com/api/editors/invite");
    expect(init.method).toBe("POST");
    const fetchHeaders = init.headers as Record<string, string>;
    expect(fetchHeaders["Content-Type"]).toBe("application/json");
    expect(fetchHeaders.Origin).toBe("https://blog.example.com");
    expect(fetchHeaders.Cookie).toBe(
      "sb-access-token=atok; sb-refresh-token=rtok",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      email: "new@example.com",
      role: "editor",
      display_name: "New Editor",
    });
  });

  it("uses VERCEL_URL when NEXT_PUBLIC_SITE_URL is missing (preview)", async () => {
    // Arrange — preview 想定。VERCEL_URL から https で組み立てる。
    process.env.VERCEL_URL = "blog-git-feat-foo.vercel.app";
    setupCookies();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "e2" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Act
    await inviteEditorAction(
      makeFormData({
        email: "new@example.com",
        role: "editor",
        display_name: "Preview Editor",
      }),
    );

    // Assert
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://blog-git-feat-foo.vercel.app/api/editors/invite");
    const fetchHeaders = init.headers as Record<string, string>;
    expect(fetchHeaders.Origin).toBe("https://blog-git-feat-foo.vercel.app");
  });

  it("falls back to http://localhost:3000 in local dev when no site env is set", async () => {
    // Arrange — dev 想定。NEXT_PUBLIC_SITE_URL / VERCEL_URL 共に無い場合は localhost に倒す。
    // Round 2 fix: csrf.ts の allowed origins と host 表記を揃えるため `127.0.0.1` ではなく
    // `localhost` を使う (両者が同じ env 解決ロジックに乗ることで、 dev 下で
    // hono/csrf が 403 を返さないことを保証する)。
    setupCookies();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "e2" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Act
    await inviteEditorAction(
      makeFormData({
        email: "new@example.com",
        role: "admin",
        display_name: "Local Admin",
      }),
    );

    // Assert
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/api/editors/invite");
    const fetchHeaders = init.headers as Record<string, string>;
    expect(fetchHeaders.Origin).toBe("http://localhost:3000");
  });

  it("respects PORT env in local dev fallback", async () => {
    // Arrange — dev で PORT を変えた場合 (例: 3001) も追従する。
    process.env.PORT = "3001";
    setupCookies();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "e2" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Act
    await inviteEditorAction(
      makeFormData({
        email: "new@example.com",
        role: "editor",
        display_name: "Dev",
      }),
    );

    // Assert
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/api/editors/invite");
  });

  it("ignores Host header injection (Origin must come from env, not from request)", async () => {
    // Arrange — 攻撃者が `Host: evil.com` を注入しても、Server Action は env から
    // Origin を組み立てるため宛先は env で固定される (cookie 流出を防ぐ)。
    // ここでは headers() を一切呼ばない実装になっていることを fetch 宛先で確認する。
    process.env.NEXT_PUBLIC_SITE_URL = "https://blog.example.com";
    setupCookies();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "e2" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Act
    await inviteEditorAction(
      makeFormData({
        email: "new@example.com",
        role: "editor",
        display_name: "Victim",
      }),
    );

    // Assert — 宛先は NEXT_PUBLIC_SITE_URL に固定される。evil.com には絶対に飛ばない。
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://blog.example.com/api/editors/invite");
    expect(url).not.toContain("evil.com");
    const fetchHeaders = init.headers as Record<string, string>;
    expect(fetchHeaders.Origin).toBe("https://blog.example.com");
  });

  it("only forwards sb-* cookies, not unrelated cookies", async () => {
    // Arrange — Supabase session 復元に必要な sb-* のみ転送し、
    //   関係のない cookie (analytics 系など) は forward 範囲から外す。
    process.env.NEXT_PUBLIC_SITE_URL = "https://blog.example.com";
    setupCookies({
      cookieList: [
        { name: "sb-access-token", value: "atok" },
        { name: "sb-refresh-token", value: "rtok" },
        { name: "_ga", value: "GA1.2.123" },
        { name: "next-locale", value: "ja" },
        { name: "csrf", value: "should-not-leak" },
      ],
    });
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "e2" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Act
    await inviteEditorAction(
      makeFormData({
        email: "new@example.com",
        role: "editor",
        display_name: "Filtered",
      }),
    );

    // Assert
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const fetchHeaders = init.headers as Record<string, string>;
    expect(fetchHeaders.Cookie).toBe(
      "sb-access-token=atok; sb-refresh-token=rtok",
    );
    expect(fetchHeaders.Cookie).not.toContain("_ga");
    expect(fetchHeaders.Cookie).not.toContain("next-locale");
    expect(fetchHeaders.Cookie).not.toContain("csrf");
  });

  it("throws with response body detail when /api/editors/invite returns 4xx", async () => {
    // Arrange
    process.env.NEXT_PUBLIC_SITE_URL = "https://blog.example.com";
    setupCookies();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Act + Assert
    await expect(
      inviteEditorAction(
        makeFormData({
          email: "new@example.com",
          role: "editor",
          display_name: "New",
        }),
      ),
    ).rejects.toThrow(/failed to invite/);
  });

  it("throws with both error code and message joined when /api/editors/invite returns 5xx rollback failed body", async () => {
    // Arrange — Hono route が返す `invite_failed_rollback_failed` + message を
    //   Server Action でも throw で表面化させ、admin UI の error boundary 側で
    //   原因が分かるようにする。仕様回帰 (code と message のどちらかしか出ない実装) を
    //   捕まえるため、両方が含まれることを assert する。
    process.env.NEXT_PUBLIC_SITE_URL = "https://blog.example.com";
    setupCookies();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invite_failed_rollback_failed",
          message: "invite quota exceeded",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    // Act + Assert — error code と message が両方とも throw された Error.message に乗ること。
    const promise = inviteEditorAction(
      makeFormData({
        email: "new@example.com",
        role: "editor",
        display_name: "New",
      }),
    );
    await expect(promise).rejects.toThrow(/failed to invite/);
    await expect(promise).rejects.toThrow(/invite_failed_rollback_failed/);
    await expect(promise).rejects.toThrow(/invite quota exceeded/);
  });

  describe("Origin / CSRF alignment regression (Round 2)", () => {
    // resolveSelfOrigin() が返す origin は、 Hono の csrfMiddleware が許可する
    // origin と完全一致しなければ、 Server Action から /api/editors/invite への
    // loopback fetch が `hono/csrf` で 403 で弾かれる (招待 form が必ず失敗する) 。
    // dev / preview / production の各シナリオで「Server Action が組み立てる Origin が
    // 必ず csrf の allowed origins に含まれる」ことを assert する。
    //
    // NODE_ENV は @types/node 22 で readonly 化されているため、テストでは
    // Reflect で書き換える (`process.env.NODE_ENV = "development"` だと型エラー)。
    function setNodeEnv(value: "development" | "production"): void {
      Reflect.set(process.env, "NODE_ENV", value);
    }

    it("dev (no env): Server Action Origin is included in csrf allowed origins", async () => {
      // Arrange — dev 想定 (production でない、 NEXT_PUBLIC_SITE_URL / VERCEL_URL は無し)。
      setNodeEnv("development");
      setupCookies();
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "e2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      // Act
      await inviteEditorAction(
        makeFormData({
          email: "new@example.com",
          role: "editor",
          display_name: "Dev",
        }),
      );

      // Assert
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const fetchHeaders = init.headers as Record<string, string>;
      const allowed = getAllowedOrigins();
      expect(allowed).toContain(fetchHeaders.Origin);
    });

    it("dev with PORT=3001: Server Action Origin is included in csrf allowed origins", async () => {
      // Arrange — dev で PORT を差し替えた場合も両者が追従していること。
      setNodeEnv("development");
      process.env.PORT = "3001";
      setupCookies();
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "e2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      // Act
      await inviteEditorAction(
        makeFormData({
          email: "new@example.com",
          role: "editor",
          display_name: "Dev",
        }),
      );

      // Assert
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const fetchHeaders = init.headers as Record<string, string>;
      const allowed = getAllowedOrigins();
      expect(allowed).toContain(fetchHeaders.Origin);
    });

    it("production with NEXT_PUBLIC_SITE_URL: Server Action Origin is included in csrf allowed origins", async () => {
      // Arrange — production で NEXT_PUBLIC_SITE_URL が設定されている場合。
      setNodeEnv("production");
      process.env.NEXT_PUBLIC_SITE_URL = "https://blog.example.com";
      setupCookies();
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "e2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      // Act
      await inviteEditorAction(
        makeFormData({
          email: "new@example.com",
          role: "editor",
          display_name: "Prod",
        }),
      );

      // Assert
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const fetchHeaders = init.headers as Record<string, string>;
      const allowed = getAllowedOrigins();
      expect(allowed).toContain(fetchHeaders.Origin);
    });
  });
});
