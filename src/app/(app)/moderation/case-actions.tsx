"use client";

import { useState } from "react";
import { issueModerationSanction, triageModerationCase } from "./actions";
import type { ReportCategory } from "@/lib/moderation";

export function CaseActions({ caseId, category, isAdmin }: { caseId: string; category: ReportCategory; isAdmin: boolean }) {
  const [message, setMessage] = useState("");
  async function act(action: () => Promise<{ ok: boolean }>, success: string) {
    setMessage(""); const result = await action(); setMessage(result.ok ? success : "Action refusée. Réessaie.");
  }
  return <div className="mt-2 flex flex-wrap gap-2">
    <button type="button" onClick={() => act(() => triageModerationCase(caseId, "triaged", 1), "Dossier trié.")} className="min-h-10 rounded-full border border-white/15 px-3 text-xs text-white/80">Trier</button>
    {isAdmin && <><button type="button" onClick={() => act(() => issueModerationSanction(caseId, "warning", null, category), "Avertissement enregistré.")} className="min-h-10 rounded-full border border-amber-300/40 px-3 text-xs text-amber-100">Avertir</button><button type="button" onClick={() => act(() => issueModerationSanction(caseId, "mentorship_restriction", 7, category), "Restriction 7 jours enregistrée.")} className="min-h-10 rounded-full border border-amber-300/40 px-3 text-xs text-amber-100">Restreindre 7 j</button><button type="button" onClick={() => act(() => issueModerationSanction(caseId, "mentorship_restriction", 30, category), "Restriction 30 jours enregistrée.")} className="min-h-10 rounded-full border border-amber-300/40 px-3 text-xs text-amber-100">Restreindre 30 j</button></>}
    {message && <p className="w-full text-xs text-white/65" role={message.startsWith("Action") ? "alert" : "status"}>{message}</p>}
  </div>;
}
