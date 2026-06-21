import "server-only";

import { createClient } from "@supabase/supabase-js";

// service-role: seed only — 初期 admin upsert 1 経路のみで service-role を握る
// (rules/api.md 「機密の取り扱い」要件)。

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function fail(msg: string): never {
  console.error(`[seed] ${msg}`);
  process.exit(1);
}

async function main() {
  if (!SUPABASE_URL) fail("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY is not set");
  if (!ADMIN_EMAIL) fail("ADMIN_EMAIL is not set");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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

await main();
