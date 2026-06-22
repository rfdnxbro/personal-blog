import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

// このページは cookie + RLS でユーザー固有データを返す。
// ビルド時のプリレンダリング (env 未設定の CI で落ちる) を避けるため動的レンダリングを強制する。
export const dynamic = "force-dynamic";

type PostRow = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  updated_at: string;
};

export default async function AdminPostsPage() {
  const supabase = await createServerClient();
  // RLS が editor / admin にだけ全件 SELECT を許す (rules/api.md)。未認証ならここは空配列で返る。
  const { data, error } = await supabase
    .from("posts")
    .select("id, slug, title, status, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return <p>記事一覧の取得に失敗しました</p>;
  }
  const posts = (data ?? []) as PostRow[];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">記事管理</h1>
        <Link
          href="/admin/posts/new"
          className="rounded bg-blue-600 px-3 py-1 text-white"
        >
          新規作成
        </Link>
      </header>
      <ul className="space-y-2">
        {posts.map((post) => (
          <li
            key={post.id}
            className="flex items-center justify-between rounded border border-gray-200 p-3"
          >
            <div>
              <Link
                href={`/admin/posts/${post.id}/edit`}
                className="font-medium text-blue-600 hover:underline"
              >
                {post.title}
              </Link>
              <span className="ml-2 text-xs text-gray-500">{post.status}</span>
            </div>
            <time className="text-sm text-gray-500">
              {new Date(post.updated_at).toLocaleString("ja-JP")}
            </time>
          </li>
        ))}
      </ul>
    </main>
  );
}
