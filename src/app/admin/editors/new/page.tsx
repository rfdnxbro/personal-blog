import { inviteEditorAction } from "../_actions";

// admin 専用 UI なので動的レンダリング (プリレンダリングしない)。
export const dynamic = "force-dynamic";

// editor 招待フォーム。 form 送信は Server Action 経由で Hono POST /api/editors/invite を
// 叩き、 secret key の利用経路を editors route に閉じたまま auth.admin.inviteUserByEmail
// + editors INSERT のトランザクションを起動する (CLAUDE.md / rules/api.md)。
export default function NewEditorPage() {
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
