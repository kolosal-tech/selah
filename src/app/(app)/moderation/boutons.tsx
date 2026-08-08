"use client";

import { useState } from "react";
import { resolveReport, setVideoHidden } from "@/app/actions";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useMessages } from "@/i18n/client";

/** Boutons d'action de modération : état visible, échec annoncé, jamais muet. */
export function BoutonsModeration({
  videoId,
  reportId,
  hidden,
}: {
  videoId: string;
  reportId?: string;
  hidden: boolean;
}) {
  const m = useMessages();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const [etatCache, setEtatCache] = useState(hidden);
  const [clos, setClos] = useState(false);

  async function basculerMasquage() {
    setOccupe(true);
    setErreur("");
    try {
      const r = await setVideoHidden(videoId, !etatCache);
      if (r?.ok) setEtatCache(!etatCache);
      else setErreur(m.moderation.refusRole);
    } catch {
      setErreur(m.moderation.echec);
    }
    setOccupe(false);
  }

  async function clore() {
    if (!reportId) return;
    setOccupe(true);
    setErreur("");
    try {
      const r = await resolveReport(reportId);
      if (r?.ok) setClos(true);
      else setErreur(m.moderation.refusClotureRole);
    } catch {
      setErreur(m.moderation.echec);
    }
    setOccupe(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={basculerMasquage}
          disabled={occupe}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
            etatCache
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
          }`}
        >
          {occupe ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : etatCache ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          <span>{etatCache ? m.moderation.retablir : m.moderation.masquer}</span>
        </button>
        {reportId && !clos && (
          <button
            onClick={clore}
            disabled={occupe}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white/80 transition hover:bg-white/20 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{m.moderation.clore}</span>
          </button>
        )}
        {clos && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <Check className="h-3.5 w-3.5" /> {m.moderation.traite}
          </span>
        )}
      </div>
      {etatCache && (
        <p className="text-[11px] text-white/40">
          {m.moderation.masqueeInfo}
        </p>
      )}
      {erreur && <p className="text-xs text-rose-400">{erreur}</p>}
    </div>
  );
}
