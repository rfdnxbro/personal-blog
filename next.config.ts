import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
];

// Supabase Storage の hostname を NEXT_PUBLIC_SUPABASE_URL から動的に解決する。
// env 未設定でも build 自体は通したい (CI / local dev の DX) ので、解決に失敗した場合は
// 安全なプレースホルダ host にフォールバックする (本番 deploy では env が必ず入る前提)。
const SUPABASE_HOST_FALLBACK = "placeholder.supabase.co";

function resolveSupabaseHost(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) {
    return SUPABASE_HOST_FALLBACK;
  }
  try {
    return new URL(raw).hostname;
  } catch {
    return SUPABASE_HOST_FALLBACK;
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: resolveSupabaseHost(),
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
