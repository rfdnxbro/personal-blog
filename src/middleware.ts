import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { adminGuard, type GuardEditor } from "@/server/auth/admin-guard";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  return adminGuard({
    request,
    response,
    user: user ? { id: user.id, email: user.email ?? null } : null,
    fetchEditor: async (userId): Promise<GuardEditor | null> => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabasePublishableKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !supabasePublishableKey) {
        return null;
      }

      const supabase = createSupabaseServerClient(
        supabaseUrl,
        supabasePublishableKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll() {
              // updateSession で同期済みのため middleware 側からは書き込まない
            },
          },
        },
      );

      const { data, error } = await supabase
        .from("editors")
        .select("id, role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return { id: data.id as string, role: data.role as "admin" | "editor" };
    },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
