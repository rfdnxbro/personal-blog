import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { inviteEditorAction } from "../_actions";

// admin 専用 UI なので動的レンダリング (プリレンダリングしない)。
export const dynamic = "force-dynamic";

// editor 招待フォーム。 form 送信は Server Action 経由で Hono POST /api/editors/invite を
// 叩き、 secret key の利用経路を editors route に閉じたまま auth.admin.inviteUserByEmail
// + editors INSERT のトランザクションを起動する (CLAUDE.md / rules/api.md)。
//
// admin gate: 非 admin (role="editor") にも form を見せて submit 時に Hono 側で 403 を返す
// 二段構えは UX が悪い。RLS が一次源で認可は守られているため、ここでは「admin にだけ UI を
// 見せる」最小調整として current user の role を読み、admin 以外は notFound() で 404 を返す。
export default async function NewEditorPage() {
  const supabase = await createServerClient();
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

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">editor を招待</h1>
      <form action={inviteEditorAction} className="space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">email</span>
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            className="rounded border border-gray-300 p-2"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">role</span>
          <select
            name="role"
            required
            defaultValue="editor"
            className="rounded border border-gray-300 p-2"
          >
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">display name</span>
          <input
            name="display_name"
            required
            maxLength={80}
            className="rounded border border-gray-300 p-2"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          招待を送る
        </button>
      </form>
    </main>
  );
}
