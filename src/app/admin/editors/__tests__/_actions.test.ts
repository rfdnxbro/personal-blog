import { beforeEach, describe, expect, it, vi } from "vitest";

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

// Server Action は headers() / cookies() を経由して Origin / Cookie を Hono route に
// 横流しする。Next ランタイムに依存するためモジュールモックで差し替える。
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

import { cookies, headers } from "next/headers";
import { inviteEditorAction } from "../_actions";

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

function setupHeadersAndCookies(opts?: {
  host?: string | null;
  proto?: string | null;
  cookieList?: Array<{ name: string; value: string }>;
}) {
  const host = opts?.host === undefined ? "example.com" : opts.host;
  const proto = opts?.proto === undefined ? "https" : opts.proto;
  const cookieList = opts?.cookieList ?? [
    { name: "sb-access-token", value: "tok" },
    { name: "sb-refresh-token", value: "ref" },
  ];

  vi.mocked(headers).mockResolvedValue({
    get: vi.fn().mockImplementation((name: string) => {
      const normalized = name.toLowerCase();
      if (normalized === "host") return host;
      if (normalized === "x-forwarded-proto") return proto;
      return null;
    }),
    // biome-ignore lint/suspicious/noExplicitAny: Next の ReadonlyHeaders を満たすための stub
  } as any);
  vi.mocked(cookies).mockResolvedValue({
    getAll: vi.fn().mockReturnValue(cookieList),
    // biome-ignore lint/suspicious/noExplicitAny: Next の ReadonlyRequestCookies を満たすための stub
  } as any);
}

beforeEach(() => {
  vi.mocked(headers).mockReset();
  vi.mocked(cookies).mockReset();
  // global.fetch は test ごとに差し替える前提。reset しておく。
  vi.restoreAllMocks();
});

describe("inviteEditorAction (Server Action)", () => {
  it("throws when email is not a valid email address", async () => {
    // Arrange
    setupHeadersAndCookies();
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
    setupHeadersAndCookies();
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
    setupHeadersAndCookies();
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

  it("posts JSON to /api/editors/invite with Cookie + Origin headers and parsed body", async () => {
    // Arrange — 正常系。 fetch 呼び出しの URL / headers / body を検証する。
    setupHeadersAndCookies({
      host: "blog.example.com",
      proto: "https",
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

  it("falls back to http when x-forwarded-proto is missing (local dev)", async () => {
    // Arrange — 開発環境では x-forwarded-proto が無く、リバプロを通らない。
    setupHeadersAndCookies({ host: "localhost:3000", proto: null });
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

  it("throws with response body detail when /api/editors/invite returns 4xx", async () => {
    // Arrange
    setupHeadersAndCookies();
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

  it("throws when /api/editors/invite returns 5xx with rollback failed body", async () => {
    // Arrange — Hono route が返す invite_failed_rollback_failed を Server Action でも
    //   throw で表面化させ、admin UI の error boundary 側で表示できるようにする。
    setupHeadersAndCookies();
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
});
