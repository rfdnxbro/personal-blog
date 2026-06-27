import Link from "next/link";
import { fetchRecentPublishedPosts } from "./_lib/recent-posts";

// 公開トップは createServerClient (cookies に依存) を毎リクエストで叩く動的ページ。
// プリレンダリング時に env が無い CI で落ちないよう動的レンダリングを強制する。
export const dynamic = "force-dynamic";

const RECENT_POSTS_LIMIT = 5;

export default async function Page() {
  const { posts, error } = await fetchRecentPublishedPosts(RECENT_POSTS_LIMIT);

  return (
    <main className="mx-auto max-w-3xl space-y-12 px-6 py-12">
      <section className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">blog</h1>
        <p className="text-gray-600">ryu の個人ブログ。技術メモと雑記。</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">最新記事</h2>
        {error ? (
          <p className="text-gray-500">最新記事の取得に失敗しました。</p>
        ) : posts.length === 0 ? (
          <p className="text-gray-500">まだ記事はありません。</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id} className="flex flex-col gap-1">
                <Link
                  href={`/posts/${post.slug}`}
                  className="text-blue-600 hover:underline"
                >
                  {post.title}
                </Link>
                {post.published_at && (
                  <span className="text-sm text-gray-500">
                    {new Date(post.published_at).toLocaleDateString("ja-JP")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link href="/posts" className="text-blue-600 hover:underline">
            もっと見る →
          </Link>
        </p>
      </section>
    </main>
  );
}
