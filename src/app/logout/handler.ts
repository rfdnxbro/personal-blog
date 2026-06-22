import "server-only";

import { type NextRequest, NextResponse } from "next/server";

export type HandleLogoutInput = {
  request: NextRequest;
  signOut: () => Promise<void>;
  allowedOrigins: string[];
};

export async function handleLogout(
  input: HandleLogoutInput,
): Promise<NextResponse> {
  const { request, signOut, allowedOrigins } = input;

  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.includes(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  await signOut();

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

/**
 * /logout で許可する Origin の集合を組み立てる。
 *
 * - 本番: NEXT_PUBLIC_SITE_URL のみ
 * - Vercel preview: NEXT_PUBLIC_SITE_URL に加え `https://${VERCEL_URL}` (デプロイごとに変わる preview origin)
 * - dev: NEXT_PUBLIC_SITE_URL + http://localhost:3000 (env 未設定でも開発できるよう localhost は許可)
 */
export function buildAllowedOrigins(): string[] {
  const origins = new Set<string>();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) origins.add(siteUrl);

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) origins.add(`https://${vercelUrl}`);

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
  }

  return Array.from(origins);
}
