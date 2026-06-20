import "server-only";

import type { Context } from "hono";

// Vercel / 一般的なリバースプロキシ経由の client IP を取り出す。
// 取得できなければ "unknown" を返す (rate-limit の bucket キーとしてはそれでも機能する)。
export function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = c.req.header("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
