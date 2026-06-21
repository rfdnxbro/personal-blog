import type { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { buildAllowedOrigins, handleLogout } from "./handler";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleLogout({
    request,
    allowedOrigins: buildAllowedOrigins(),
    signOut: async () => {
      const supabase = await createServerClient();
      await supabase.auth.signOut();
    },
  });
}
