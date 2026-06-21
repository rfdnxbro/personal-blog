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

// Supabase client は外部 I/O 境界なのでモジュールモックする (rules/testing.md)。
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { updatePostAction } from "../_actions";

type ChainStub = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

function makeFromStub(): ChainStub {
  const stub: ChainStub = {
    select: vi.fn().mockReturnThis() as ChainStub["select"],
    update: vi.fn().mockReturnThis() as ChainStub["update"],
    eq: vi.fn().mockReturnThis() as ChainStub["eq"],
    single: vi.fn(),
  };
  return stub;
}

function makeSupabase(fromStub: ChainStub) {
  return {
    from: vi.fn().mockReturnValue(fromStub),
  };
}

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

const POST_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.mocked(createServerClient).mockReset();
});

describe("updatePostAction (Server Action) — published_at handling", () => {
  it("sets published_at when status flips to published (current published_at is null)", async () => {
    // Arrange — 1st single(): SELECT current row、update 後は chain 終端で resolve する。
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValueOnce({
      data: { published_at: null, status: "draft" },
      error: null,
    });
    // update().eq() の終端 await を resolve させる。
    fromStub.eq = vi.fn().mockImplementation(function impl(this: ChainStub) {
      return this;
    }) as ChainStub["eq"];
    // update chain は thenable で完了する。chain は `.update(x).eq("id", id)` で await。
    // eq は then を持つ resolved 風 object を返す必要がある。
    // 単純化のため、update の戻り chain 末端の eq を Promise.resolve に差し替える。
    let eqCallCount = 0;
    fromStub.eq = vi.fn().mockImplementation((..._args: unknown[]) => {
      eqCallCount += 1;
      // 1 回目: SELECT chain (select().eq().single()) — chain 継続のため this を返す。
      // 2 回目: UPDATE chain (update().eq()) — terminal await のため resolved を返す。
      if (eqCallCount === 1) {
        return fromStub;
      }
      return Promise.resolve({ data: null, error: null });
    }) as ChainStub["eq"];
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    // Act
    await updatePostAction(
      makeFormData({
        id: POST_ID,
        title: "hello",
        content_md: "# hi",
        status: "published",
      }),
    );

    // Assert
    const updateArg = fromStub.update.mock.calls[0]?.[0] as {
      status?: string;
      published_at?: string;
    };
    expect(updateArg.status).toBe("published");
    expect(updateArg.published_at).toBeDefined();
  });

  it("does NOT overwrite published_at when re-saving an already-published post", async () => {
    // Arrange — 既に published な post に対する Server Action 経由の再保存。
    const existingPublishedAt = "2020-01-01T00:00:00.000Z";
    const fromStub = makeFromStub();
    fromStub.single.mockResolvedValueOnce({
      data: { published_at: existingPublishedAt, status: "published" },
      error: null,
    });
    let eqCallCount = 0;
    fromStub.eq = vi.fn().mockImplementation((..._args: unknown[]) => {
      eqCallCount += 1;
      if (eqCallCount === 1) {
        return fromStub;
      }
      return Promise.resolve({ data: null, error: null });
    }) as ChainStub["eq"];
    vi.mocked(createServerClient).mockResolvedValue(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用 supabase stub
      makeSupabase(fromStub) as any,
    );

    // Act
    await updatePostAction(
      makeFormData({
        id: POST_ID,
        title: "edited title",
        content_md: "# updated body",
        status: "published",
      }),
    );

    // Assert — 既存の published_at は上書きされない。
    const updateArg = fromStub.update.mock.calls[0]?.[0] as {
      published_at?: string;
    };
    expect(updateArg.published_at).toBeUndefined();
  });
});
