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

  return redirect(request, "/");
}
