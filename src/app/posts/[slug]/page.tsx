import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommentForm } from "@/components/CommentForm";
import { CommentList } from "@/components/CommentList";
import PostBody from "@/components/PostBody";
import { buildPostMetadata, extractDescription } from "@/lib/seo";
import { createServerClient } from "@/lib/supabase/server";

// /posts/[slug] も createServerClient (cookies) を叩くため動的レンダリング。
// CI の build 段階で env が無くてもプリレンダリングを試みないようにする。
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("posts")
    .select("title, content_md")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!data) {
    return { title: "Not Found" };
  }

  return buildPostMetadata({
    title: data.title,
    description: extractDescription(data.content_md),
    slug,
  });
}

export default async function PostDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, slug, title, content_md, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const { data: commentsData } = await supabase
    .from("comments")
    .select("id, author_name, body, created_at")
    .eq("post_id", data.id)
    .order("created_at", { ascending: true });

  const comments = commentsData ?? [];
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <main className="mx-auto max-w-2xl p-6">
      <article>
        <header className="mb-6">
          <h1 className="text-3xl font-bold">{data.title}</h1>
          {data.published_at && (
            <p className="mt-1 text-sm text-gray-500">
              {new Date(data.published_at).toLocaleDateString("ja-JP")}
            </p>
          )}
        </header>
        <PostBody contentMd={data.content_md} />
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">コメント</h2>
          <CommentList comments={comments} />
          <div className="mt-6">
            <CommentForm postId={data.id} turnstileSiteKey={turnstileSiteKey} />
          </div>
        </section>
      </article>
    </main>
  );
}
