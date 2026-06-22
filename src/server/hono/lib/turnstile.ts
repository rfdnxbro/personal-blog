import "server-only";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

// Cloudflare Turnstile の siteverify を叩く。
// 失敗系は **すべて false に倒す (fail closed)**:
//   - secret 未設定
//   - fetch 自体の例外 (network / DNS)
//   - HTTP 非 2xx
//   - JSON parse 失敗
//   - body.success !== true
// 仕様上 verifyTurnstile は throw しない。throw すると route 側で 500 になり、
// 攻撃者は「サーバが落ちた」シグナルを得るだけで silent reject と区別できる。
export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as SiteverifyResponse;
    return data.success === true;
  } catch {
    // network error / json parse 失敗 / その他例外はすべて false (fail closed)。
    return false;
  }
}
