import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// このページは cookie + RLS でユーザー固有データを返す。
// ビルド時のプリレンダリング (env 未設定の CI で落ちる) を避けるため動的レンダリングを強制する。
export const dynamic = "force-dynamic";

type EditorRow = {
  id: string;
  email: string;
  role: "admin" | "editor";
  display_name: string;
  created_at: string;
};

export default async function AdminEditorsPage() {
  const supabase = await createServerClient();

  // 非 admin (role="editor") にも form を見せて 403 で弾く二段構えは UX が悪い。
  // RLS が一次源で認可は守られているため、ここでは「admin にだけ UI を見せる」最小調整として
  // current user の role を読み、admin 以外は notFound() で 404 を返す。
  // 認可の二重実装ではなく、admin 専用 UI の可視性制御。
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    notFound();
  }
  const { data: meRow } = await supabase
    .from("editors")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (meRow?.role !== "admin") {
    notFound();
  }

  // editors の全件 SELECT は RLS で admin (current_editor_role() = 'admin') にだけ許される。
  // 非 admin がここに辿り着いても空配列が返るだけで、 secret key の取り扱いは Hono route 側に
  // 閉じている。
  const { data, error } = await supabase
    .from("editors")
    .select("id, email, role, display_name, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return <p>editor 一覧の取得に失敗しました</p>;
  }
  const editors = (data ?? []) as EditorRow[];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">editor 管理</h1>
        <Link
          href="/admin/editors/new"
          className="rounded bg-blue-600 px-3 py-1 text-white"
        >
          新規招待
        </Link>
      </header>
      {editors.length === 0 ? (
        <p className="text-sm text-gray-500">editor は登録されていません</p>
      ) : (
        <ul className="space-y-2">
          {editors.map((editor) => (
            <li
              key={editor.id}
              className="flex items-center justify-between rounded border border-gray-200 p-3"
            >
              <div>
                <span className="font-medium">{editor.display_name}</span>
                <span className="ml-2 text-sm text-gray-700">
                  {editor.email}
                </span>
                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  {editor.role}
                </span>
              </div>
              <time className="text-sm text-gray-500">
                {new Date(editor.created_at).toLocaleString("ja-JP")}
              </time>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
