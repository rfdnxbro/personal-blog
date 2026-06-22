import { ImageResponse } from "next/og";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 } as const;
const TITLE_MAX = 80;
// title クエリに紐づく OG 画像は実質 immutable (タイトル文字列の関数なので、
// 同じクエリなら同じ画像になる)。CDN / ブラウザ両方に長めにキャッシュさせる。
const CACHE_CONTROL = "public, immutable, max-age=86400";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("title")?.trim();
  const title = raw && raw.length > 0 ? raw.slice(0, TITLE_MAX) : "blog";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "80px",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 28,
          letterSpacing: "0.2em",
          color: "#94a3b8",
          marginBottom: 24,
        }}
      >
        BLOG
      </div>
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.2,
          maxWidth: "100%",
        }}
      >
        {title}
      </div>
    </div>,
    {
      ...SIZE,
      headers: { "Cache-Control": CACHE_CONTROL },
    },
  );
}
