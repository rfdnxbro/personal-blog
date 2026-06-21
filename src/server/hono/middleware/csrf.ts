import "server-only";

import { csrf } from "hono/csrf";

// 許可 Origin:
//   - 本番: NEXT_PUBLIC_SITE_URL のみ
//   - preview: Vercel が注入する VERCEL_URL を https://<host> 形式で追加
//   - dev: http://localhost:3000 を追加
// rules/api.md 「Origin / CSRF 検証」の方針通り、wildcard マッチは採用しない。
function buildAllowedOrigins(): string[] {
  const origins = new Set<string>();
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    origins.add(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
  }
  return Array.from(origins);
}

export const csrfMiddleware = csrf({
  origin: buildAllowedOrigins(),
});
