import { notFound } from "next/navigation";
import MarkdownEditor from "@/components/MarkdownEditor";
import { createServerClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

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
      <form
        action={`/api/posts/${data.id}`}
        method="post"
        className="space-y-4"
      >
        {/* PATCH を <form> から直接出せないため、Hono 側 POST + override も後続 PR で */}
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
    </main>
  );
}
