import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

/**
 * next クエリの安全判定。callback 側 (`handler.ts`) と同じルールを揃える:
 * - "/" で始まる
 * - "//" で始まらない (protocol-relative URL の open redirect 防止)
 *
 * 安全と判定された値だけを OAuth provider の redirectTo に乗せる。
 */
function safeNextPath(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next } = await searchParams;
  const safeNext = safeNextPath(next);

  async function signIn() {
    "use server";

    const supabase = await createServerClient();
    const requestHeaders = await headers();
    // 優先度: 本番設定 (NEXT_PUBLIC_SITE_URL) > Vercel preview 自動注入 (VERCEL_URL)
    // > リクエスト Origin (dev のフォールバック)。
    // OAuth provider 側の callback 許可リストに乗っているのは本番ドメインだけなので、
    // env を最優先しないと preview から本番 callback に戻されて壊れる。
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const vercelUrl = process.env.VERCEL_URL;
    const origin =
      siteUrl ??
      (vercelUrl ? `https://${vercelUrl}` : null) ??
      requestHeaders.get("origin") ??
      "http://localhost:3000";

    // 安全な next が来ていれば callback URL のクエリに引き継ぐ。
    // OAuth provider 経由でも redirectTo 文字列はそのまま保たれるので、
    // callback の handler.ts 側で再度安全判定したうえで deep link 復帰する。
    const callbackUrl = safeNext
      ? `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
      : `${origin}/auth/callback`;

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (oauthError || !data?.url) {
      redirect("/login?error=unauthorized");
    }

    redirect(data.url);
  }

  return (
    <main>
      <h1>Sign in</h1>
      {error === "unauthorized" ? (
        <p role="alert">
          許可リストに無いアカウントです。管理者に依頼してください。
        </p>
      ) : null}
      <form action={signIn}>
        <button type="submit">Google でログイン</button>
      </form>
    </main>
  );
}
