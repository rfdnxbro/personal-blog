import { notFound } from "next/navigation";
import MarkdownEditor from "@/components/MarkdownEditor";
import { createServerClient } from "@/lib/supabase/server";
import { deletePostAction, updatePostAction } from "../../_actions";

// このページは admin 専用 + cookie ベースでデータが変わるため動的レンダリング。
// CI ビルド時に Supabase env が無くてもプリレンダリングしないことで build を通す。
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// admin UI は Server Action 直結 (CLAUDE.md 「Server Component 優先」)。
// HTML form の method は GET/POST しか出せないため、PATCH 相当の更新は Server Action で
// 表現する (Hono /api/posts/:id PATCH を fetch しなくて済む)。
export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, slug, title, content_md, status")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">記事編集</h1>
      <form action={updatePostAction} className="space-y-4">
        <input type="hidden" name="id" value={data.id} />
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">タイトル</span>
          <input
            name="title"
            defaultValue={data.title}
            required
            maxLength={200}
            className="rounded border border-gray-300 p-2"
          />
        </label>
        <p className="text-xs text-gray-500">slug: {data.slug}</p>
        <MarkdownEditor name="content_md" defaultValue={data.content_md} />
        <div className="flex gap-3">
          <button
            type="submit"
            name="status"
            value="draft"
            className="rounded bg-gray-600 px-4 py-2 text-white"
          >
            下書き保存
          </button>
          <button
            type="submit"
            name="status"
            value="published"
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            公開
          </button>
        </div>
      </form>
      <form action={deletePostAction} className="mt-8">
        <input type="hidden" name="id" value={data.id} />
        <button
          type="submit"
          className="rounded border border-red-500 px-4 py-2 text-sm text-red-600"
        >
          削除
        </button>
      </form>
    </main>
  );
}
