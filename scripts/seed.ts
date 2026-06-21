// tsx 経由の直接実行では Next.js の env 自動読み込みが効かないため明示的に .env を読む
import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

// secret-key: seed only — server-only は付けない (tsx 直接実行で throw する); Node API で import 経路を閉じる

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

// tsx の CJS 経路で top-level await が禁止されるため main().catch() 形式にする
main().catch((err) => {
  console.error(`[seed] unexpected error: ${err}`);
  process.exit(1);
});
