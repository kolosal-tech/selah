"use client";

import { useState } from "react";
import { unblockAuthor } from "@/app/actions";

type UnblockButtonProps = {
  authorId: string;
  errorMessage: string;
  label: string;
};

export function UnblockButton({ authorId, errorMessage, label }: UnblockButtonProps) {
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState(false);

  async function annuler() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const result = await unblockAuthor(authorId);
      if (result.ok) {
        // Le retrait visuel n'arrive qu'après la confirmation serveur : un échec
        // doit laisser la ligne visible et permettre une nouvelle tentative.
        setRemoved(true);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (removed) return null;

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void annuler()}
        disabled={busy}
        aria-busy={busy}
        className="min-h-11 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
      >
        {label}
      </button>
      {error && <p className="text-sm text-rose-200" role="alert">{errorMessage}</p>}
    </div>
  );
}
