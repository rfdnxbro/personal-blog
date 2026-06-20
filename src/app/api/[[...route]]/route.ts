import { handle } from "hono/vercel";
import { app } from "@/server/hono/app";

// `@supabase/ssr` の cookie 操作は Node ランタイム前提のため edge には切り替えない。
export const runtime = "nodejs";

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
