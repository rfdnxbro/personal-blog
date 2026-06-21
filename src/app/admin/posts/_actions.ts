"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPostBody,
  type PostStatus,
  postIdParam,
  updatePostBody,
} from "@/lib/schemas";
import { createServerClient } from "@/lib/supabase/server";
import { slugify } from "@/server/hono/lib/slug";

// admin UI からの記事 CRUD は HTML form を Server Action に渡す。
// Hono route (POST /api/posts 等) を fetch するのと違って、form-urlencoded のまま
// Supabase クライアントを叩け、CSRF は Next の Server Actions が自動でガードする。
// 認可は RLS が一次源 (rules/api.md)、ここでは zod 検証 + Supabase クエリだけを行う。
function getStatus(input: FormDataEntryValue | null): PostStatus {
  const value = typeof input === "string" ? input : "draft";
  return value === "published" ? "published" : "draft";
}

function asStringOrUndefined(
  value: FormDataEntryValue | null,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function createPostAction(formData: FormData): Promise<void> {
  const title = formData.get("title");
  const slugRaw = formData.get("slug");
  const contentMd = formData.get("content_md");
  const status = getStatus(formData.get("status"));

  const parsed = createPostBody.safeParse({
    title: typeof title === "string" ? title : "",
    slug: asStringOrUndefined(slugRaw),
    content_md: typeof contentMd === "string" ? contentMd : "",
    status,
  });
  if (!parsed.success) {
    throw new Error(`invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  }

  const slug = parsed.data.slug ?? slugify(parsed.data.title);
  if (!slug) {
    throw new Error("invalid: failed to derive slug from title");
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("posts").insert({
    title: parsed.data.title,
    slug,
    content_md: parsed.data.content_md,
    status: parsed.data.status,
  });
  if (error) {
    // RLS や unique 違反は ここでは throw して Next の error.tsx に投げる
    // (admin 専用 UI なので簡素なエラー表示で十分)。
    throw new Error(`failed to create post: ${error.message}`);
  }

  revalidatePath("/admin/posts");
  revalidatePath("/posts");
  redirect("/admin/posts");
}

export async function updatePostAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  const title = formData.get("title");
  const contentMd = formData.get("content_md");
  const status = getStatus(formData.get("status"));

  const idParsed = postIdParam.safeParse({
    id: typeof idRaw === "string" ? idRaw : "",
  });
  if (!idParsed.success) {
    throw new Error("invalid: missing post id");
  }

  const bodyParsed = updatePostBody.safeParse({
    title: asStringOrUndefined(title),
    content_md: asStringOrUndefined(contentMd),
    status,
  });
  if (!bodyParsed.success) {
    throw new Error(
      `invalid: ${bodyParsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  const supabase = await createServerClient();
  // status を published に切り替える「初回」のみ published_at をセットする。
  // 既に published 済みの post を再保存しても published_at を現在時刻で上書きしない
  // (Hono PATCH /posts/:id と同一ロジック)。
  // 実装: 現状の published_at を SELECT し、新 status が "published" かつ
  //       既存 published_at が null のときだけ now() を埋める。
  // race condition は admin 操作 (同一ユーザーが同時編集しない前提) なので無視可能。
  const update: Record<string, unknown> = { ...bodyParsed.data };
  if (bodyParsed.data.status === "published") {
    const { data: current, error: selectError } = await supabase
      .from("posts")
      .select("published_at")
      .eq("id", idParsed.data.id)
      .single();
    if (selectError) {
      throw new Error(`failed to load post: ${selectError.message}`);
    }
    if (current?.published_at == null) {
      update.published_at = new Date().toISOString();
    }
  }

  const { error } = await supabase
    .from("posts")
    .update(update)
    .eq("id", idParsed.data.id);
  if (error) {
    throw new Error(`failed to update post: ${error.message}`);
  }

  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${idParsed.data.id}/edit`);
  revalidatePath("/posts");
  redirect("/admin/posts");
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const idRaw = formData.get("id");
  const idParsed = postIdParam.safeParse({
    id: typeof idRaw === "string" ? idRaw : "",
  });
  if (!idParsed.success) {
    throw new Error("invalid: missing post id");
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", idParsed.data.id);
  if (error) {
    throw new Error(`failed to delete post: ${error.message}`);
  }

  revalidatePath("/admin/posts");
  revalidatePath("/posts");
  redirect("/admin/posts");
}
