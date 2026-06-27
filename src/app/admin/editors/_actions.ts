"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { inviteEditorBody } from "@/lib/schemas";

// Hono CSRF middleware (hono/csrf) は Origin ヘッダで許可 host を判定する。
// Origin を request の `Host` ヘッダから組み立てると Host header injection で fetch 宛先が
// 外部に逸れ、Cookie に乗せた Supabase session が攻撃者の指定先に流出するため、
// 外部入力を一切信頼せず env から固定的に解決する (csrf.ts と決定方式を揃える)。
//   1. 本番 (prod):     NEXT_PUBLIC_SITE_URL
//   2. preview:         https://${VERCEL_URL}
//   3. dev:             http://127.0.0.1:${PORT ?? 3000}
function resolveSelfOrigin(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && siteUrl.length > 0) {
    return siteUrl;
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && vercelUrl.length > 0) {
    return `https://${vercelUrl}`;
  }
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}

// Supabase auth-helpers / @supabase/ssr は cookie 名を `sb-*` プレフィックスで発行する
// (例: `sb-<project-ref>-auth-token`, `sb-access-token`, `sb-refresh-token`)。
// 全 cookie を Hono route に転送すると関係のない cookie まで毎回 forward されるため、
// session 復元に必要な `sb-*` のみに絞る。
function isSupabaseSessionCookie(cookieName: string): boolean {
  return cookieName.startsWith("sb-");
}

// admin による editor 招待は SUPABASE_SECRET_KEY (`auth.admin.inviteUserByEmail`) を叩く必要が
// あるが、 secret key の利用経路を増やさないため、 Server Action から直接 createClient せず
// Hono POST /api/editors/invite を fetch して既存の経路に流す。
// 認可は Hono route 側の admin role check + editors RLS が二重に効くため、ここでは zod 検証
// と Origin / Cookie の中継だけを行う薄い層に留める (rules/api.md)。
export async function inviteEditorAction(formData: FormData): Promise<void> {
  const emailRaw = formData.get("email");
  const roleRaw = formData.get("role");
  const displayNameRaw = formData.get("display_name");

  const parsed = inviteEditorBody.safeParse({
    email: typeof emailRaw === "string" ? emailRaw : "",
    role: typeof roleRaw === "string" ? roleRaw : "",
    display_name: typeof displayNameRaw === "string" ? displayNameRaw : "",
  });
  if (!parsed.success) {
    throw new Error(`invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }

  // Origin は外部入力を一切信頼せず env から固定的に決定する (上記コメント参照)。
  const origin = resolveSelfOrigin();

  // 現セッションの Supabase cookie をそのまま転送して Hono route 側で createServerClient
  // にセッションを復元させる。 fetch は cookie を自動付与しないため明示的に組み立てる。
  // Supabase 以外の cookie は転送せず、forward 範囲を最小化する。
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .filter((c) => isSupabaseSessionCookie(c.name))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const response = await fetch(`${origin}/api/editors/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: origin,
    },
    body: JSON.stringify(parsed.data),
  });

  if (!response.ok) {
    // Hono route は { error, message? } 形式で error 詳細を返す。本文をそのまま
    // throw で表面化して Next の error.tsx で表示できるようにする。
    let detail = `${response.status}`;
    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };
      const parts = [body.error, body.message].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
      if (parts.length > 0) {
        detail = parts.join(": ");
      }
    } catch {
      // JSON parse 失敗時はステータスコードだけ残す。
    }
    throw new Error(`failed to invite: ${detail}`);
  }

  revalidatePath("/admin/editors");
  redirect("/admin/editors");
}
