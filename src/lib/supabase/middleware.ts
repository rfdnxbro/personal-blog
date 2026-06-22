import "server-only";

import {
  type CookieMethodsServer,
  createServerClient as createSupabaseServerClient,
} from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function readSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }
  return { supabaseUrl, supabasePublishableKey };
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = readSupabaseEnv();
  if (!env) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set",
    );
  }

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const { name, value } of cookiesToSet) {
        request.cookies.set(name, value);
      }
      response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
    },
  };

  const supabase = createSupabaseServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    { cookies: cookieMethods },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

/**
 * Cookie 読み取り専用の Supabase client。
 * Next root middleware から admin-guard 用に editor 行を引くときに使う。
 * updateSession で同期済みなので middleware からは書き込まない (setAll は noop)。
 *
 * env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) が未設定の場合は null を返す。
 */
export function createMiddlewareReadClient(request: NextRequest) {
  const env = readSupabaseEnv();
  if (!env) {
    return null;
  }

  return createSupabaseServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
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
}
