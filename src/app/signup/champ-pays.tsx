"use client";

import { useMemo } from "react";
import { useLocale, useMessages } from "@/i18n/client";

/** Liste ISO 3166-1 alpha-2 des pays proposés à l'inscription. */
const PAYS: readonly string[] = [
  "AF","AL","DZ","DE","AD","AO","AR","AM","AU","AT","AZ","BS","BH","BD","BB",
  "BE","BZ","BJ","BT","BY","BO","BA","BW","BR","BN","BG","BF","BI","KH","CM",
  "CA","CV","CF","CL","CN","CY","CO","KM","CG","CD","KR","KP","CR","CI","HR",
  "CU","DK","DJ","DO","EG","SV","AE","EC","ER","ES","EE","ET","FJ","FI","FR",
  "GA","GM","GE","GH","GR","GT","GN","GW","GQ","GY","HT","HN","HU","IN","ID",
  "IQ","IR","IE","IS","IL","IT","JM","JP","JO","KZ","KE","KG","KW","LA","LS",
  "LV","LB","LR","LY","LI","LT","LU","MK","MG","MY","MW","MV","ML","MT","MA",
  "MU","MR","MX","MD","MC","MN","ME","MZ","MM","NA","NP","NI","NE","NG","NO",
  "NZ","OM","UG","UZ","PK","PA","PG","PY","NL","PE","PH","PL","PT","QA","RO",
  "GB","RU","RW","SM","SN","RS","SC","SL","SG","SK","SI","SO","SD","SS","LK",
  "SE","CH","SR","SY","TJ","TZ","TD","TH","TL","TG","TT","TN","TM","TR","UA",
  "UY","US","VU","VE","VN","YE","ZM","ZW",
];

/**
 * Sélecteur de pays : noms localisés par Intl.DisplayNames (aucune liste de
 * noms à maintenir), trié dans l'ordre alphabétique de la langue courante,
 * pré-rempli avec le pays détecté par la géolocalisation IP.
 */
export function ChampPays({ paysDetecte }: { paysDetecte: string | null }) {
  const locale = useLocale();
  const m = useMessages();

  const options = useMemo(() => {
    const noms = new Intl.DisplayNames([locale], { type: "region" });
    return PAYS.map((code) => ({ code, nom: noms.of(code) ?? code })).sort((a, b) =>
      a.nom.localeCompare(b.nom, locale),
    );
  }, [locale]);

  const defaut =
    paysDetecte && PAYS.includes(paysDetecte.toUpperCase())
      ? paysDetecte.toUpperCase()
      : "";

  return (
    <div className="flex flex-col gap-1">
      <select
        name="country"
        required
        defaultValue={defaut}
        className="glass-input rounded-xl p-3 text-white [&>option]:bg-slate-900"
      >
        <option value="" disabled>
          {m.auth.pays}
        </option>
        {options.map((p) => (
          <option key={p.code} value={p.code}>
            {p.nom}
          </option>
        ))}
      </select>
      <p className="px-1 text-xs text-white/45">
        {defaut ? `${m.auth.paysDetecte(defaut)} · ` : ""}
        {m.auth.langueSuivra}
      </p>
    </div>
  );
}
