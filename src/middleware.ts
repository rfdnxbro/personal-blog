import type { NextRequest } from "next/server";
import {
  createMiddlewareReadClient,
  updateSession,
} from "@/lib/supabase/middleware";
import { adminGuard, type GuardEditor } from "@/server/auth/admin-guard";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  return adminGuard({
    request,
    response,
    user: user ? { id: user.id, email: user.email ?? null } : null,
    fetchEditor: async (userId): Promise<GuardEditor | null> => {
      const supabase = createMiddlewareReadClient(request);
      if (!supabase) {
        console.error(
          "[middleware] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set; treating user as non-editor",
        );
        return null;
      }

      const { data, error } = await supabase
        .from("editors")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return { id: data.id as string };
    },
  });
}

export const config = {
  // /api/admin/** は middleware で redirect せず、各 Hono route が
  // session + RLS (42501 → 403 マップ) で個別に守る (PR-B 以降)。
  matcher: ["/admin/:path*"],
};
