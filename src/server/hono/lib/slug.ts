import "server-only";

// title から slug を導出する。posts.slug の DB check 制約 + zod schema と完全一致させる
// (`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)。
export function slugify(input: string): string {
  const lower = input.toLowerCase();
  const ascii = lower.replace(/[^a-z0-9]+/g, "-");
  // 先に leading/trailing ハイフンを削除した上で 100 文字に truncate。
  // 切り詰めた結果ハイフンが末尾に来るケース (例: `a-a-a-...-a-` を 100 文字で切ると `-` 終端)
  // を防ぐため、truncate 後にもう一度 trailing ハイフンを落とす。
  // (review #19: trailing-hyphen trim runs before truncation バグ修正)
  const trimmed = ascii.replace(/^-+|-+$/g, "");
  return trimmed.slice(0, 100).replace(/-+$/g, "");
}
