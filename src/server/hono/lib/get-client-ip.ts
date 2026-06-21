import "server-only";

import type { Context } from "hono";

// Vercel / 一般的なリバースプロキシ経由の client IP を取り出す。
//
// `x-forwarded-for` の先頭はクライアントが任意に追記できる (Vercel は信頼できる実 IP を
// 末尾に追加する形式)。`x-real-ip` は Vercel / 多くのプロキシがクライアント書き換え不可で
// 注入する真の IP のため、こちらを先に見て信頼できる値を優先する。
// 取得できなければ "unknown" を返す (rate-limit の bucket キーとしてはそれでも機能する)。
export function getClientIp(c: Context): string {
  const real = c.req.header("x-real-ip");
  if (real) {
    const trimmed = real.trim();
    if (trimmed) return trimmed;
  }
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
