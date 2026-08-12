"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function submitModerationAppeal(sanctionId: string, statement: string) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  const text = statement.trim();
  if (text.length < 20 || text.length > 2000) return { ok: false as const };
  const { data, error } = await supabase.rpc("submit_moderation_appeal", { p_sanction_id: sanctionId, p_statement: text });
  if (error || !data) return { ok: false as const };
  revalidatePath("/profile/safety");
  return { ok: true as const };
}
