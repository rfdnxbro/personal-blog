import { notFound } from "next/navigation";
import PostBody from "@/components/PostBody";
import { createServerClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ slug: string }>;
};

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
        {/* PR-C で CommentList / CommentForm を差し込む */}
      </article>
    </main>
  );
}
