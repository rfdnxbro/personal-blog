import "server-only";

import { createMiddleware } from "hono/factory";
import { createServerClient } from "@/lib/supabase/server";
import { getClientIp } from "../lib/get-client-ip";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export type RateLimitOptions = {
  // 識別子 (例: 'comments_post')。bucket キーに含めて他 route と分離する。
  key: string;
  perMinute: number;
  perHour: number;
};

function floorToBucket(now: number, unitMs: number): string {
  return new Date(now - (now % unitMs)).toISOString();
}

// Supabase の rate_limits テーブルを使った sliding window 風 rate limit。
// 完全な sliding window ではなく「直前 1 分 / 1 時間にかぶるウィンドウ行の count 合計」で
// 判定する近似実装 (粒度はバケットサイズに依存)。Phase 1 個人ブログ規模では十分。
export function rateLimit(options: RateLimitOptions) {
  return createMiddleware(async (c, next) => {
    const ip = getClientIp(c);
    const now = Date.now();
    const minuteWindow = floorToBucket(now, MINUTE_MS);
    const hourWindow = floorToBucket(now, HOUR_MS);
    const minuteBucket = `${ip}:${options.key}:m`;
    const hourBucket = `${ip}:${options.key}:h`;
    const minuteSince = new Date(now - MINUTE_MS).toISOString();
    const hourSince = new Date(now - HOUR_MS).toISOString();

    const supabase = await createServerClient();

    const [minutes, hours] = await Promise.all([
      supabase
        .from("rate_limits")
        .select("count")
        .eq("bucket", minuteBucket)
        .gte("window_start", minuteSince),
      supabase
        .from("rate_limits")
        .select("count")
        .eq("bucket", hourBucket)
        .gte("window_start", hourSince),
    ]);

    const minuteCount = (minutes.data ?? []).reduce(
      (s, r) => s + (r.count ?? 0),
      0,
    );
    if (minuteCount >= options.perMinute) {
      return c.json({ error: "too_many_requests" }, 429);
    }
    const hourCount = (hours.data ?? []).reduce(
      (s, r) => s + (r.count ?? 0),
      0,
    );
    if (hourCount >= options.perHour) {
      return c.json({ error: "too_many_requests" }, 429);
    }

    // atomic increment は SQL 関数経由 (0005_rate_limits.sql で定義)。
    await Promise.all([
      supabase.rpc("increment_rate_limit", {
        p_bucket: minuteBucket,
        p_window_start: minuteWindow,
      }),
      supabase.rpc("increment_rate_limit", {
        p_bucket: hourBucket,
        p_window_start: hourWindow,
      }),
    ]);

    await next();
  });
}
