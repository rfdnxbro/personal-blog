import "server-only";

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createPostBody, postIdParam, updatePostBody } from "@/lib/schemas";
import { createServerClient } from "@/lib/supabase/server";
import type { AppEnv } from "../app";
import { mapDbError } from "../lib/db-error";
import { slugify } from "../lib/slug";

// posts CRUD route。認可は RLS に委ね、Hono は zod 検証 + Supabase クエリ +
// mapDbError による HTTP 変換だけを担う薄層 (rules/api.md)。
const route = new Hono<AppEnv>()
  // 公開記事一覧 (GET は CSRF middleware を素通り、未認証 OK、RLS で published のみ返る)。
  .get("/", async (c) => {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("posts")
      .select("id, slug, title, published_at, created_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) {
      const m = mapDbError(error);
      return c.json(m.body, m.status);
    }
    return c.json({ data: data ?? [] }, 200);
  })
  .post("/", zValidator("json", createPostBody), async (c) => {
    const user = c.get("user");
    const editor = c.get("editor");
    if (!user) return c.json({ error: "unauthorized" }, 401);

    const body = c.req.valid("json");
    const slug = body.slug ?? slugify(body.title);
    if (!slug) return c.json({ error: "invalid" }, 400);

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("posts")
      .insert({
        // author_id は editor が居る場合のみ渡す。editor が null の場合は RLS が 42501 を返す前提。
        ...(editor ? { author_id: editor.id } : {}),
        title: body.title,
        slug,
        content_md: body.content_md,
        status: body.status,
      })
      .select()
      .single();
    if (error) {
      const m = mapDbError(error);
      return c.json(m.body, m.status);
    }
    return c.json(data, 200);
  })
  .patch(
    "/:id",
    zValidator("param", postIdParam),
    zValidator("json", updatePostBody),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ error: "unauthorized" }, 401);

      const { id } = c.req.valid("param");
      const body = c.req.valid("json");

      // status を published に切り替えるタイミングで published_at を 1 度だけセットする
      // (アプリ層明示更新方針、rules/supabase.md 「両用禁止」)。
      const update: Record<string, unknown> = { ...body };
      if (body.status === "published") {
        update.published_at = new Date().toISOString();
      }

      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("posts")
        .update(update)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        const m = mapDbError(error);
        return c.json(m.body, m.status);
      }
      return c.json(data, 200);
    },
  )
  .delete("/:id", zValidator("param", postIdParam), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);

    const { id } = c.req.valid("param");

    const supabase = await createServerClient();
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      const m = mapDbError(error);
      return c.json(m.body, m.status);
    }
    return c.json({ ok: true }, 200);
  });

export default route;
