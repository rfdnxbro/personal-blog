import "server-only";

import { type NextRequest, NextResponse } from "next/server";

export type GuardUser = { id: string; email: string | null };
/**
 * editor 行が存在することだけを表す軽量型。
 *
 * role の細分化 (admin vs editor) は middleware で判定しない。
 * RLS が唯一の真実の源なので、admin route 側で DB クエリを投げて
 * 42501 (insufficient_privilege) を 403 にマップする方針 (PR-B 以降)。
 */
export type GuardEditor = { id: string };

export type FetchEditor = (userId: string) => Promise<GuardEditor | null>;

export type AdminGuardInput = {
  request: NextRequest;
  response: NextResponse;
  user: GuardUser | null;
  fetchEditor: FetchEditor;
};

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  // 元のパス + 検索文字列を ?next=... に詰めてログイン後の deep link 復帰を可能にする。
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/login";
  url.search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export async function adminGuard(
  input: AdminGuardInput,
): Promise<NextResponse> {
  const { request, response, user, fetchEditor } = input;

  if (!isAdminPath(request.nextUrl.pathname)) {
    return response;
  }

  if (!user) {
    return redirectToLogin(request);
  }

  const editor = await fetchEditor(user.id);
  if (!editor) {
    return redirectToLogin(request);
  }

  return response;
}
