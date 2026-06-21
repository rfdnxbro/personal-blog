import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

type PostRow = {
  id: string;
  slug: string;
  title: string;
  published_at: string | null;
};

export default async function PostsIndexPage() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, slug, title, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    return <p>記事一覧の取得に失敗しました</p>;
  }

  const posts = (data ?? []) as PostRow[];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">記事一覧</h1>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/posts/${post.slug}`}
              className="text-blue-600 hover:underline"
            >
              {post.title}
            </Link>
            {post.published_at && (
              <span className="ml-2 text-sm text-gray-500">
                {new Date(post.published_at).toLocaleDateString("ja-JP")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
