import "server-only";

import { createMiddleware } from "hono/factory";
import { createServerClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };
export type SessionEditor = { id: string; role: "admin" | "editor" };

export type SessionVars = {
  user: SessionUser | null;
  editor: SessionEditor | null;
};

// cookie から Supabase セッションを取り出し、editor 行 (role / id) も解決して
// c.var.user / c.var.editor に流し込む。認可判定は RLS が一次源で、ここではあくまで
// 「ルート側が条件分岐する用の入力」を提供するだけ。
export const sessionMiddleware = createMiddleware<{ Variables: SessionVars }>(
  async (c, next) => {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    c.set("user", user ? { id: user.id, email: user.email ?? null } : null);

    if (user) {
      const { data: editor } = await supabase
        .from("editors")
        .select("id, role")
        .eq("user_id", user.id)
        .maybeSingle();
      c.set(
        "editor",
        editor
          ? { id: editor.id as string, role: editor.role as "admin" | "editor" }
          : null,
      );
    } else {
      c.set("editor", null);
    }

    await next();
  },
);
