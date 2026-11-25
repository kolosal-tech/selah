import { timingSafeEqual } from "node:crypto";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const headers = { "cache-control": "no-store" };
  const fixture = process.env.SELAH_VPS_FIXTURE;
  if (!fixture) return Response.json({ ok: false }, { status: 404, headers });
  const expected = Buffer.from((JSON.parse(fixture) as { password: string }).password);
  const got = Buffer.from(request.headers.get("x-migration-token") ?? "");
  if (!expected.length || expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return Response.json({ ok: false }, { status: 404, headers });
  }
  try {
    const response = await fetch(supabaseUrl + "/auth/v1/settings", {
      headers: { apikey: supabaseAnonKey },
      signal: AbortSignal.timeout(4500),
    });
    const settings = await response.json() as { external?: { email?: boolean } };
    const ok = response.ok && settings.external?.email === true &&
      supabaseUrl === process.env.NEXT_PUBLIC_SELAH_VPS_URL;
    return Response.json({ ok, backend: "vps" }, { status: ok ? 200 : 503, headers });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
