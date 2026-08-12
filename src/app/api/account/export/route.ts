import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { data, error } = await supabase.rpc("export_my_account");
  if (error || !data) return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  const payload = JSON.stringify({ schema_version: "1", account_email: user.email ?? null, data });
  return new NextResponse(payload, {
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Disposition": "attachment; filename=selah-account-export.json",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
