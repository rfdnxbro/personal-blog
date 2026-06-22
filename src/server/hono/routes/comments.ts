import "server-only";

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { commentIdParam, createCommentBody } from "@/lib/schemas";
import { createServerClient } from "@/lib/supabase/server";
import type { AppEnv } from "../app";
import { mapDbError } from "../lib/db-error";
import { getClientIp } from "../lib/get-client-ip";
import { verifyTurnstile as defaultVerifyTurnstile } from "../lib/turnstile";
import { rateLimit } from "../middleware/rate-limit";

// 依存注入用 factory 引数。Hono ルート単体テストで Supabase / Turnstile を stub する経路。
// プロダクションでは routes/index.ts が createServerClient と verifyTurnstile を渡し、
// テストでは stub を渡すことで、@/lib/supabase/server を vi.mock せずに済ませる
// (rules/testing.md 「@supabase/ssr 自体をモジュールモックしない」)。
//
// テストから supabase の薄い stub (insert/select/delete のメソッドチェイン部分集合) を
// 渡せるよう、SupabaseClient 全体ではなく「実体の `from()` シグネチャに代入可能な値」
// を許す形に緩めている。実行時に必要なメソッドを呼ぶだけで、型レベルでは duck typing。
export type SupabaseLike = Pick<
  Awaited<ReturnType<typeof createServerClient>>,
  "from" | "rpc"
>;
export type CommentsDeps = {
  getSupabase: () => Promise<SupabaseLike> | SupabaseLike;
  verifyTurnstile?: (token: string, ip?: string) => Promise<boolean>;
};

// 匿名コメント API。スパム対策 4 点セットを route 内で組み合わせる
// (rate-limit + Turnstile + honeypot + URL/文字数上限。rules/api.md 必須要件)。
// 認可は RLS が一次源 (comments_insert_public / comments_delete_editor) に委ねる。
export function createCommentsRoute(deps: CommentsDeps) {
  const { getSupabase } = deps;
  const verifyTurnstile = deps.verifyTurnstile ?? defaultVerifyTurnstile;

  return new Hono<AppEnv>()
    .post(
      "/:postId",
      rateLimit({
        key: "comments_post",
        perMinute: 5,
        perHour: 30,
        getSupabase,
      }),
      zValidator("param", z.object({ postId: z.string().uuid() })),
      zValidator("json", createCommentBody),
      async (c) => {
        const { postId } = c.req.valid("param");
        const input = c.req.valid("json");

        // honeypot: 値が入っていたら 200 silent drop。insert もログも残さない。
        if (input.website && input.website.length > 0) {
          return c.json({ ok: true }, 200);
        }

        const ip = getClientIp(c);
        const ok = await verifyTurnstile(input.turnstileToken, ip);
        if (!ok) {
          return c.json({ error: "turnstile_failed" }, 400);
        }

        const supabase = await getSupabase();
        const { data, error } = await supabase
          .from("comments")
          .insert({
            post_id: postId,
            author_name: input.author_name,
            body: input.body,
          })
          .select("id, post_id, author_name, body, created_at")
          .single();
        if (error) {
          const m = mapDbError(error);
          return c.json(m.body, m.status);
        }
        return c.json(data, 201);
      },
    )
    .delete("/:id", zValidator("param", commentIdParam), async (c) => {
      const { id } = c.req.valid("param");
      const supabase = await getSupabase();
      // RLS で editor 以外は 0 行に絞られる。Supabase は権限弾きを 42501 ではなく
      // 「成功 + 0 行」で返してしまうため、削除後の行を select で取り戻して
      // 空なら 404 にマッピングする (silent success だと caller 側が削除成功と誤認する)。
      const { data, error } = await supabase
        .from("comments")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) {
        const m = mapDbError(error);
        return c.json(m.body, m.status);
      }
      if (!data || data.length === 0) {
        return c.json({ error: "not_found" }, 404);
      }
      return c.body(null, 204);
    });
}

// プロダクション用デフォルト export。routes/index.ts はこれを使う。
// 依存はモジュールスコープで束ねず、毎リクエストで createServerClient を呼ぶ
// (cookie store が request 毎に異なるため)。
const comments = createCommentsRoute({
  getSupabase: () => createServerClient(),
});

export default comments;
