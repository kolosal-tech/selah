"use client";

import { useState } from "react";
import { submitModerationAppeal } from "./actions";

export function AppealButton({ sanctionId }: { sanctionId: string }) {
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [statement, setStatement] = useState("");
  return <div className="mt-3">
    <label className="block text-sm text-white/80" htmlFor={`appeal-${sanctionId}`}>Explique ta demande d’appel (20 à 2 000 caractères).</label>
    <textarea id={`appeal-${sanctionId}`} value={statement} onChange={(event) => setStatement(event.target.value)} minLength={20} maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white" />
    <button type="button" disabled={state === "sent"} onClick={async () => {
      setState((await submitModerationAppeal(sanctionId, statement)).ok ? "sent" : "error");
    }} className="min-h-11 rounded-full border border-amber-300/50 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50">
      {state === "sent" ? "Appel transmis" : "Faire appel"}
    </button>
    {state === "error" && <p className="mt-2 text-sm text-rose-200" role="alert">L’appel n’a pas pu être transmis. Il est peut-être expiré ou déjà déposé.</p>}
  </div>;
}
