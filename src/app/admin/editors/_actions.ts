"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { inviteEditorBody } from "@/lib/schemas";

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

  // Hono CSRF middleware (hono/csrf) は Origin ヘッダで許可 host を判定するため、
  // Server Action 側から自分の現在ドメインを Origin として明示的に渡す。
  // x-forwarded-proto は Vercel / リバプロを通る経路で立つ。ローカル dev では立たないので
  // http にフォールバックする。
  const headerStore = await headers();
  const host = headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (!host) {
    throw new Error("invalid: missing host header");
  }
  const origin = `${proto}://${host}`;

  // 現セッションの Supabase cookie をそのまま転送して Hono route 側で createServerClient
  // にセッションを復元させる。 fetch は cookie を自動付与しないため明示的に組み立てる。
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
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
