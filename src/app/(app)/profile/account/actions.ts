"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function currentSupabase() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function requestAccountDeletion() {
  const supabase = await currentSupabase();
  if (!supabase) return { ok: false as const };
  const { data, error } = await supabase.rpc("request_account_deletion");
  if (error || !data) return { ok: false as const };
  revalidatePath("/profile/account");
  return { ok: true as const };
}

export async function cancelAccountDeletion() {
  const supabase = await currentSupabase();
  if (!supabase) return { ok: false as const };
  const { data, error } = await supabase.rpc("cancel_account_deletion");
  if (error || !data) return { ok: false as const };
  revalidatePath("/profile/account");
  return { ok: true as const };
}

export async function revokeOtherSessions() {
  const supabase = await currentSupabase();
  if (!supabase) return { ok: false as const };
  const { data, error } = await supabase.rpc("revoke_account_sessions", { p_scope: "others" });
  if (error || !data) return { ok: false as const };
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) return { ok: false as const };
  revalidatePath("/profile/account");
  return { ok: true as const };
}

export async function revokeAllSessions() {
  const supabase = await currentSupabase();
  if (!supabase) redirect("/login");
  const { data, error } = await supabase.rpc("revoke_account_sessions", { p_scope: "global" });
  if (error || !data) return { ok: false as const };
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError) return { ok: false as const };
  redirect("/login?info=sessions-revoquees");
}
