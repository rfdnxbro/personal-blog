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

export function buildAllowedOrigins(): string[] {
  const origins: string[] = [];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) origins.push(siteUrl);
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) origins.push(`https://${vercelUrl}`);
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000");
  }
  return origins;
}
