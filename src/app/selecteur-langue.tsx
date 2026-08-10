"use client";

import { useRef, useTransition } from "react";
import { Globe } from "lucide-react";
import { setLocale } from "@/app/actions";
import { LOCALES, NOM_LANGUE } from "@/i18n/config";
import { useLocale, useMessages } from "@/i18n/client";

/**
 * Sélecteur de langue : un globe + la liste des douze langues, chacune dans
 * sa propre écriture. Le changement est immédiat (server action + cookie),
 * sans rechargement complet.
 */
export function SelecteurLangue({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const m = useMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();

  return (
    <form ref={formRef} action={setLocale} className="relative inline-flex shrink-0 items-center">
      <Globe className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-amber-300" />
      <select
        name="locale"
        aria-label={m.commun.langue}
        defaultValue={locale}
        onChange={() => startTransition(() => formRef.current?.requestSubmit())}
        className={`min-h-11 appearance-none rounded-full border border-white/15 bg-white/10 ps-8 text-white/85 backdrop-blur-xl transition hover:bg-white/20 [&>option]:bg-slate-900 [&>option]:text-white ${
          compact
            ? "w-11 pe-0 text-transparent sm:h-auto sm:w-auto sm:pe-2 sm:py-1.5 sm:text-[11px] sm:text-white/85"
            : "pe-3 py-2 text-xs"
        }`}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {NOM_LANGUE[l]}
          </option>
        ))}
      </select>
    </form>
  );
}
