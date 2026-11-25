import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ClaimedDeletion = { request_id: string; user_id: string };
type StorageEntry = { name: string; id?: string | null };

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SELAH_VPS_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SELAH_VPS_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function listOwnedObjects(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  bucket: "avatars" | "videos",
  prefix: string,
): Promise<string[]> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  const objects: string[] = [];
  for (const entry of (data ?? []) as StorageEntry[]) {
    const path = `${prefix}/${entry.name}`;
    // L'API représente les dossiers sans id ; on les descend, sans jamais les
    // supprimer comme s'il s'agissait d'un fichier.
    if (entry.id) objects.push(path);
    else objects.push(...await listOwnedObjects(supabase, bucket, path));
  }
  return objects;
}

async function removeOwnedObjects(
  supabase: NonNullable<ReturnType<typeof serviceClient>>,
  userId: string,
): Promise<number> {
  let deleted = 0;
  for (const bucket of ["avatars", "videos"] as const) {
    const paths = await listOwnedObjects(supabase, bucket, userId);
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { error } = await supabase.storage.from(bucket).remove(batch);
      if (error) throw error;
      deleted += batch.length;
    }
  }
  return deleted;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const supabase = serviceClient();
  if (!supabase) return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  const { data, error } = await supabase.rpc("claim_due_account_deletions", { p_limit: 10 });
  if (error) return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  let processed = 0;
  let failed = 0;
  for (const claim of (data ?? []) as ClaimedDeletion[]) {
    try {
      const deleted = await removeOwnedObjects(supabase, claim.user_id);
      const existing = await supabase.auth.admin.getUserById(claim.user_id);
      const missing = Boolean(existing.error && "status" in existing.error && existing.error.status === 404);
      if (existing.error && !missing) throw existing.error;
      if (!missing) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(claim.user_id);
        if (deleteError) throw deleteError;
      }
      await supabase.rpc("finish_account_deletion", {
        p_request_id: claim.request_id,
        p_deleted: deleted,
        p_result: missing ? "already_deleted" : "deleted",
        p_failure_code: null,
      });
      processed += 1;
    } catch {
      // Le reçu ne reçoit ni UUID ni message fournisseur : seulement un code
      // stable qui permet l'investigation sans réidentifier le membre.
      await supabase.rpc("finish_account_deletion", {
        p_request_id: claim.request_id,
        p_deleted: 0,
        p_result: "failed",
        p_failure_code: "deletion_retryable",
      });
      failed += 1;
    }
  }
  return NextResponse.json({ processed, failed }, { headers: { "Cache-Control": "no-store" } });
}
