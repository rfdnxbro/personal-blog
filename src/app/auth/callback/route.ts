import type { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { handleCallback } from "./handler";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleCallback({
    request,
    exchangeCodeForSession: async (code) => {
      const supabase = await createServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return { error: error ? { message: error.message } : null };
    },
  });
}
