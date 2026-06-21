import "server-only";

// title から slug を導出する。posts.slug の DB check 制約 + zod schema と完全一致させる
// (`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)。
export function slugify(input: string): string {
  const lower = input.toLowerCase();
  const ascii = lower.replace(/[^a-z0-9]+/g, "-");
  const trimmed = ascii.replace(/^-+|-+$/g, "");
  return trimmed.slice(0, 100);
}
