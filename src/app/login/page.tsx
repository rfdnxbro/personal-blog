import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

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

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
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
