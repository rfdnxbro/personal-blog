import "server-only";

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { commentIdParam, createCommentBody } from "@/lib/schemas";
import { createServerClient } from "@/lib/supabase/server";
import type { AppEnv } from "../app";
import { mapDbError } from "../lib/db-error";
import { getClientIp } from "../lib/get-client-ip";
import { verifyTurnstile } from "../lib/turnstile";
import { rateLimit } from "../middleware/rate-limit";

// 匿名コメント API。スパム対策 4 点セットを route 内で組み合わせる
// (rate-limit + Turnstile + honeypot + URL/文字数上限。rules/api.md 必須要件)。
// 認可は RLS が一次源 (comments_insert_public / comments_delete_editor) に委ねる。
const comments = new Hono<AppEnv>()
  .post(
    "/:postId",
    rateLimit({ key: "comments_post", perMinute: 5, perHour: 30 }),
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

      const supabase = await createServerClient();
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
    const supabase = await createServerClient();
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      const m = mapDbError(error);
      return c.json(m.body, m.status);
    }
    return c.body(null, 204);
  });

export default comments;
