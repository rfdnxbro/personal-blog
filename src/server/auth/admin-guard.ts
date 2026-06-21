import "server-only";

import { type NextRequest, NextResponse } from "next/server";

export type GuardUser = { id: string; email: string | null };
export type GuardEditor = { id: string; role: "admin" | "editor" };

export type FetchEditor = (userId: string) => Promise<GuardEditor | null>;

export type AdminGuardInput = {
  request: NextRequest;
  response: NextResponse;
  user: GuardUser | null;
  fetchEditor: FetchEditor;
};

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
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
