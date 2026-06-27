import "server-only";

import { csrf } from "hono/csrf";

// 許可 Origin:
//   - 本番: NEXT_PUBLIC_SITE_URL のみ
//   - preview: Vercel が注入する VERCEL_URL を https://<host> 形式で追加
//   - dev: http://localhost:${PORT ?? 3000}
// rules/api.md 「Origin / CSRF 検証」の方針通り、wildcard マッチは採用しない。
//
// Round 2 fix: dev fallback の port は `3000` 決め打ちではなく `process.env.PORT` を
// 尊重する。 Server Action (`src/app/admin/editors/_actions.ts` の `resolveSelfOrigin`)
// が組み立てる Origin と完全一致させることで、 PORT を差し替えた dev でも hono/csrf が
// loopback fetch を 403 で弾かない (招待 form の dev 動作を保証する)。
//
// Origin 解決ロジックを Server Action 側と共有するため、 `getAllowedOrigins()` は
// テスト / 他モジュールから参照できるよう named export する。
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    origins.add(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.NODE_ENV !== "production") {
    const port = process.env.PORT ?? "3000";
    origins.add(`http://localhost:${port}`);
  }
  return Array.from(origins);
}

export const csrfMiddleware = csrf({
  // 起動時の env で固定的に評価される。 dev で PORT を変える場合は
  // 開発サーバを再起動する想定。
  origin: getAllowedOrigins(),
});
