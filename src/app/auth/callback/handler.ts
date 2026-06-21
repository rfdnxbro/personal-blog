import "server-only";

import { type NextRequest, NextResponse } from "next/server";

export type ExchangeCodeForSession = (
  code: string,
) => Promise<{ error: { message?: string } | null }>;

export type HandleCallbackInput = {
  request: NextRequest;
  exchangeCodeForSession: ExchangeCodeForSession;
};

function redirect(
  request: NextRequest,
  pathname: string,
  search = "",
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}

/**
 * deep-link 復帰用 next クエリの安全判定。
 *
 * 許可: 同一オリジン上のローカルパス (例: "/admin/posts?page=2")。
 * 拒否: protocol-relative URL ("//evil"), 絶対 URL ("https://..."),
 *       スラッシュで始まらない値。これらは open redirect の踏み台になる。
 */
function safeNextPath(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

function redirectToNextOrRoot(request: NextRequest): NextResponse {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!next) {
    return redirect(request, "/");
  }
  const url = request.nextUrl.clone();
  const [pathname, search = ""] = next.split("?", 2);
  url.pathname = pathname;
  url.search = search ? `?${search}` : "";
  return NextResponse.redirect(url);
}

export async function handleCallback(
  input: HandleCallbackInput,
): Promise<NextResponse> {
  const { request, exchangeCodeForSession } = input;
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return redirect(request, "/login", "?error=unauthorized");
  }

  const { error } = await exchangeCodeForSession(code);
  if (error) {
    return redirect(request, "/login", "?error=unauthorized");
  }

  return redirectToNextOrRoot(request);
}
