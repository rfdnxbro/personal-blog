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
    const origin =
      requestHeaders.get("origin") ??
      process.env.NEXT_PUBLIC_SITE_URL ??
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
