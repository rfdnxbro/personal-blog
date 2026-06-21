import MarkdownEditor from "@/components/MarkdownEditor";

export default function NewPostPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">新規記事</h1>
      <form action="/api/posts" method="post" className="space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">タイトル</span>
          <input
            name="title"
            required
            maxLength={200}
            className="rounded border border-gray-300 p-2"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            slug (空なら title から自動)
          </span>
          <input
            name="slug"
            maxLength={100}
            className="rounded border border-gray-300 p-2 font-mono text-sm"
          />
        </label>
        <MarkdownEditor name="content_md" />
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
