import { getLocale, getMessages } from "@/i18n/server";

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
 * Sélecteur de pays : noms localisés par `Intl.DisplayNames` (aucune liste de
 * noms à maintenir), triés dans l'ordre alphabétique de la langue courante et
 * pré-remplis avec le pays détecté par la géolocalisation IP.
 *
 * Ce composant est rendu **côté serveur uniquement**, et ce n'est pas un
 * détail de performance. `Intl.DisplayNames` et `localeCompare` s'appuient sur
 * la table ICU du moteur : celle de Node ne coïncide pas avec celle de WebKit.
 * Tant que la liste était calculée dans un composant client, Safari
 * recalculait des libellés et un ordre différents de ceux rendus par le
 * serveur, et React refusait l'hydratation de tout l'arbre (erreur #418) —
 * défaut invisible sur Chromium, dont l'ICU s'aligne avec celle de Node.
 *
 * En rendant la liste sur le serveur, une seule table ICU fait autorité et le
 * client n'a plus rien à recalculer.
 */
export async function ChampPays({ paysDetecte }: { paysDetecte: string | null }) {
  const locale = await getLocale();
  const m = await getMessages();

  const noms = new Intl.DisplayNames([locale], { type: "region" });
  const options = PAYS.map((code) => ({ code, nom: noms.of(code) ?? code })).sort(
    (a, b) => a.nom.localeCompare(b.nom, locale),
  );

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
