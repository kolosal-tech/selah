"use client";

import { useState } from "react";
import { reviewModerationAppeal } from "./actions";

export function AppealReview({ appealId, statement }: { appealId: string; statement: string }) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  async function decide(decision: "upheld" | "overturned") {
    const result = await reviewModerationAppeal(appealId, decision, note);
    setMessage(result.ok ? "Décision enregistrée." : "La note doit contenir entre 20 et 2 000 caractères, et seul un autre admin peut décider.");
  }
  return <div className="mt-3 rounded-xl border border-white/10 p-3"><p className="text-sm text-white/75">Déclaration : {statement}</p><label className="mt-3 block text-sm text-white/80" htmlFor={`decision-${appealId}`}>Note de décision (20 à 2 000 caractères)</label><textarea id={`decision-${appealId}`} value={note} onChange={(event) => setNote(event.target.value)} minLength={20} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white" /><div className="mt-2 flex gap-2"><button type="button" onClick={() => decide("upheld")} className="min-h-10 rounded-full border border-white/20 px-3 text-xs text-white">Confirmer</button><button type="button" onClick={() => decide("overturned")} className="min-h-10 rounded-full border border-emerald-300/40 px-3 text-xs text-emerald-100">Renverser</button></div>{message && <p role={message.startsWith("Décision") ? "status" : "alert"} className="mt-2 text-xs text-white/70">{message}</p>}</div>;
}
