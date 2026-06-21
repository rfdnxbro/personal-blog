import "server-only";

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { inviteEditorBody } from "@/lib/schemas";
import { createServerClient } from "@/lib/supabase/server";
import type { AppEnv } from "../app";
import { mapDbError } from "../lib/db-error";

// secret-key: invite only
// admin による招待は auth.admin.inviteUserByEmail を叩く必要があり、これは secret key
// 経由でのみ実行できる。 SUPABASE_SECRET_KEY の利用箇所はここの 1 関数と scripts/seed.ts、
// auth.users トリガー内の 3 経路に限定する (rules/api.md / CLAUDE.md)。
// editors テーブルへの INSERT は authenticated client + RLS で行い、secret key を経路として
// 広げない。
async function inviteUserByEmailViaAdmin(
  email: string,
): Promise<{ error: { message: string } | null }> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return {
      error: {
        message: "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY must be set",
      },
    };
  }
  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.inviteUserByEmail(email);
  return { error: error ? { message: error.message } : null };
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

    // 1) editors 行を authenticated client + RLS 経由で先に INSERT する。
    //    handle_new_user トリガー (0004) は auth.users INSERT 時に email allowlist で弾くため、
    //    inviteUserByEmail を先に呼ぶと「editors に未登録 → unauthorized email」で invite 自体が
    //    落ちる。順序を入れ替えて editors 行を確定させてから invite に進む。
    const supabase = await createServerClient();
    const { data, error } = await supabase
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

    // 2) editors 行 INSERT が成功してから auth.admin.inviteUserByEmail を呼ぶ。
    //    失敗したら editors 行を rollback する (整合性のため)。
    const inviteResult = await inviteUserByEmailViaAdmin(body.email);
    if (inviteResult.error) {
      await supabase.from("editors").delete().eq("id", data.id);
      return c.json({ error: inviteResult.error.message }, 500);
    }

    return c.json(data, 200);
  },
);

export default route;
