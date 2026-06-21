import "server-only";

import { zValidator } from "@hono/zod-validator";
import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { inviteEditorBody } from "@/lib/schemas";
import type { AppEnv } from "../app";
import { mapDbError } from "../lib/db-error";

// secret-key: invite only
// admin による招待は auth.admin.inviteUserByEmail を叩く必要があり、これは secret key
// 経由でのみ実行できる。 SUPABASE_SECRET_KEY の利用箇所はここと scripts/seed.ts、
// auth.users トリガー内の 3 経路に限定する (rules/api.md)。
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY must be set",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const route = new Hono<AppEnv>().post(
  "/invite",
  zValidator("json", inviteEditorBody),
  async (c) => {
    const user = c.get("user");
    const editor = c.get("editor");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    // admin role 専用 endpoint。RLS では auth.users への招待は守れないため、
    // ここだけは secret key + 明示的な role チェックで多重防御する。
    if (editor?.role !== "admin") {
      return c.json({ error: "forbidden" }, 403);
    }

    const body = c.req.valid("json");
    const admin = getAdminClient();

    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      body.email,
    );
    if (inviteErr) {
      return c.json({ error: inviteErr.message }, 500);
    }

    const { data, error } = await admin
      .from("editors")
      .insert({
        email: body.email,
        role: body.role,
        display_name: body.display_name,
      })
      .select()
      .single();
    if (error) {
      const m = mapDbError(error);
      return c.json(m.body, m.status);
    }
    return c.json(data, 200);
  },
);

export default route;
