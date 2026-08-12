"use client";

import { useState } from "react";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  revokeAllSessions,
  revokeOtherSessions,
} from "./actions";

export function AccountActions({ deletionPending }: { deletionPending: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"" | "delete" | "sessions">("");

  async function run(
    kind: "delete" | "sessions",
    action: () => Promise<{ ok: boolean }>,
    success: string,
  ) {
    setBusy(kind);
    setMessage("");
    try {
      const result = await action();
      setMessage(result.ok ? success : "Cette action n’a pas abouti. Réessaie.");
    } catch {
      setMessage("Cette action n’a pas abouti. Réessaie.");
    } finally {
      setBusy("");
    }
  }

  return <div className="flex flex-col items-start gap-3">
    <a className="min-h-11 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10" href="/api/account/export">
      Télécharger mes données (JSON)
    </a>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy === "sessions"} onClick={() => void run("sessions", revokeOtherSessions, "Les autres sessions ont été révoquées.")} className="min-h-11 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Déconnecter les autres appareils</button>
      <button type="button" disabled={busy !== ""} onClick={() => void revokeAllSessions()} className="min-h-11 rounded-full border border-amber-300/50 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50">Déconnecter tous les appareils</button>
    </div>
    {deletionPending ? <button type="button" disabled={busy === "delete"} onClick={() => void run("delete", cancelAccountDeletion, "La suppression est annulée.")} className="min-h-11 rounded-full border border-emerald-300/50 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50">Annuler la suppression</button> : <button type="button" disabled={busy === "delete"} onClick={() => void run("delete", requestAccountDeletion, "La suppression est planifiée dans 14 jours. Tu peux encore l’annuler ici.")} className="min-h-11 rounded-full border border-rose-300/50 px-4 py-2 text-sm font-semibold text-rose-100 disabled:opacity-50">Planifier la suppression du compte</button>}
    {message && <p role={message.includes("pas abouti") ? "alert" : "status"} className="text-sm text-white/75">{message}</p>}
  </div>;
}
