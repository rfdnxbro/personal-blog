import "server-only";

import type { ContentfulStatusCode } from "hono/utils/http-status";

export type DbError = { code?: string; message?: string };
export type MappedDbError = {
  body: { error: string };
  status: ContentfulStatusCode;
};

// Supabase / Postgres の SQLSTATE を HTTP ステータスに変換する。
// 雑に 500 を返すと RLS 弾きやユニーク違反まで「サーバエラー」として扱われ、運用上の
// シグナルが潰れるため必ずこのヘルパを経由する (rules/api.md 要件)。
export function mapDbError(error: DbError): MappedDbError {
  switch (error.code) {
    case "42501":
      return { body: { error: "forbidden" }, status: 403 };
    case "23505":
    case "23503":
      return { body: { error: "conflict" }, status: 409 };
    case "23514":
      return { body: { error: "invalid" }, status: 400 };
    case "PGRST116":
      return { body: { error: "not_found" }, status: 404 };
    default:
      return {
        body: { error: error.message ?? "internal_error" },
        status: 500,
      };
  }
}
