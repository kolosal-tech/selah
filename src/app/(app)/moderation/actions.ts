"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { estCategorieSignalement, type ReportCategory } from "@/lib/moderation";

async function moderationClient() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile && ["moderateur", "admin"].includes(profile.role) ? { supabase, role: profile.role } : null;
}

export async function triageModerationCase(caseId: string, status: "triaged" | "closed", priority: number) {
  const client = await moderationClient();
  if (!client || !Number.isInteger(priority) || priority < 0 || priority > 2) return { ok: false as const };
  const { data, error } = await client.supabase.rpc("triage_moderation_case", {
    p_case_id: caseId,
    p_status: status,
    p_priority: priority,
  });
  if (error || !data) return { ok: false as const };
  revalidatePath("/moderation");
  return { ok: true as const };
}

export async function issueModerationSanction(caseId: string, kind: "warning" | "mentorship_restriction", days: number | null, reason: ReportCategory) {
  const client = await moderationClient();
  if (!client || client.role !== "admin" || !estCategorieSignalement(reason)
    || (kind === "warning" && days !== null)
    || (kind === "mentorship_restriction" && days !== 7 && days !== 30)) return { ok: false as const };
  const { data, error } = await client.supabase.rpc("issue_moderation_sanction", {
    p_case_id: caseId,
    p_kind: kind,
    p_days: days,
    p_reason: reason,
  });
  if (error || !data) return { ok: false as const };
  revalidatePath("/moderation");
  revalidatePath("/profile/safety");
  return { ok: true as const };
}

export async function reviewModerationAppeal(appealId: string, decision: "upheld" | "overturned", note: string) {
  const client = await moderationClient();
  const text = note.trim();
  if (!client || client.role !== "admin" || text.length < 20 || text.length > 2000) return { ok: false as const };
  const { data, error } = await client.supabase.rpc("review_moderation_appeal", { p_appeal_id: appealId, p_decision: decision, p_note: text });
  if (error || !data) return { ok: false as const };
  revalidatePath("/moderation");
  revalidatePath("/profile/safety");
  return { ok: true as const };
}
