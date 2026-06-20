import "server-only";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

// Cloudflare Turnstile の siteverify を叩く。
// secret 未設定なら常に false を返す (fail closed)。本番では必須環境変数。
export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const res = await fetch(SITEVERIFY_URL, {
    method: "POST",
    body,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as SiteverifyResponse;
  return data.success === true;
}
