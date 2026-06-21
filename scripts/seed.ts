import { createClient } from "@supabase/supabase-js";

// secret-key: seed only — 初期 admin upsert 1 経路のみで Supabase の secret key を握る
// (rules/api.md 「機密の取り扱い」要件)。
//
// `import 'server-only'` は付けない: tsx で直接実行する Node スクリプトでは
// `react-server` condition が立たず常に throw するため。代わりに冒頭で
// `process.env` / `process.exit` という Node 専用 API を参照することで
// Web ターゲットへの import 経路を物理的に閉じる (rules/api.md 「サーバ専用
// モジュールの隔離」が許容する手段)。

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function fail(msg: string): never {
  console.error(`[seed] ${msg}`);
  process.exit(1);
}

async function main() {
  if (!SUPABASE_URL) fail("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!SUPABASE_SECRET_KEY) fail("SUPABASE_SECRET_KEY is not set");
  if (!ADMIN_EMAIL) fail("ADMIN_EMAIL is not set");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from("editors")
    .upsert(
      {
        email: ADMIN_EMAIL,
        role: "admin",
        display_name: "admin",
      },
      { onConflict: "email_normalized", ignoreDuplicates: false },
    )
    .select()
    .single();

  if (error) {
    fail(`upsert failed: ${error.message}`);
  }
  console.log(`[seed] admin ready: id=${data.id} email=${ADMIN_EMAIL}`);
}

// tsx は .ts を CJS 経由でロードするケースがあり、トップレベル await が出力時に
// "Top-level await is currently not supported with the CJS output format" で落ちる。
// main().catch(...) 形式に揃えれば ESM / CJS どちらでも動く。fail() 経由の正常系
// 異常終了は中で process.exit(1) するため、ここで拾うのは予期しない throw だけ。
main().catch((err) => {
  console.error(`[seed] unexpected error: ${err}`);
  process.exit(1);
});
