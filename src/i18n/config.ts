/**
 * Langues de Selah.
 *
 * Douze locales : les grandes langues du monde protestant et évangélique.
 * `ar` et `he` s'écrivent de droite à gauche : le layout racine pose
 * `dir="rtl"` et Tailwind (propriétés logiques) suit.
 */
export const LOCALES = [
  "fr",
  "en",
  "es",
  "pt",
  "it",
  "de",
  "ru",
  "ar",
  "he",
  "zh",
  "ja",
  "ko",
] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_PAR_DEFAUT: Locale = "en";

export const RTL: readonly Locale[] = ["ar", "he"];

export function dirDe(locale: Locale): "ltr" | "rtl" {
  return RTL.includes(locale) ? "rtl" : "ltr";
}

export function estLocale(x: string | undefined | null): x is Locale {
  return Boolean(x) && (LOCALES as readonly string[]).includes(x!);
}

/** Nom de chaque langue, écrit dans sa propre langue (autonyme). */
export const NOM_LANGUE: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  pt: "Português",
  it: "Italiano",
  de: "Deutsch",
  ru: "Русский",
  ar: "العربية",
  he: "עברית",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
};

export const COOKIE_LOCALE = "selah-locale";

/**
 * Pays (ISO 3166-1 alpha-2) → langue de l'application.
 * Un pays absent de cette table tombe sur l'anglais.
 */
export const PAYS_LANGUE: Record<string, Locale> = {
  // Français — Europe, Afrique francophone, Caraïbes, Pacifique
  FR: "fr", BE: "fr", CH: "fr", LU: "fr", MC: "fr",
  CD: "fr", CG: "fr", CI: "fr", CM: "fr", SN: "fr", ML: "fr", BF: "fr",
  NE: "fr", TG: "fr", BJ: "fr", GA: "fr", GN: "fr", TD: "fr", CF: "fr",
  RW: "fr", BI: "fr", DJ: "fr", KM: "fr", MG: "fr", HT: "fr", GP: "fr",
  MQ: "fr", GF: "fr", RE: "fr", YT: "fr", NC: "fr", PF: "fr", MU: "fr",
  SC: "fr", VU: "fr", DZ: "fr", MA: "fr", TN: "fr",
  // Espagnol — Espagne et Amérique hispanophone
  ES: "es", MX: "es", CO: "es", AR: "es", PE: "es", VE: "es", CL: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", GQ: "es", PR: "es",
  // Portugais
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt", CV: "pt", GW: "pt", ST: "pt",
  TL: "pt",
  // Italien
  IT: "it", SM: "it", VA: "it",
  // Allemand
  DE: "de", AT: "de", LI: "de",
  // Russe et sphère russophone
  RU: "ru", BY: "ru", KZ: "ru", KG: "ru", TJ: "ru", TM: "ru", UZ: "ru",
  AM: "ru", AZ: "ru", GE: "ru", MD: "ru", UA: "ru",
  // Arabe
  SA: "ar", EG: "ar", IQ: "ar", SY: "ar", JO: "ar", LB: "ar", PS: "ar",
  KW: "ar", QA: "ar", BH: "ar", AE: "ar", OM: "ar", YE: "ar", LY: "ar",
  SD: "ar", MR: "ar", SO: "ar",
  // Hébreu
  IL: "he",
  // Chinois
  CN: "zh", TW: "zh", HK: "zh", MO: "zh", SG: "zh",
  // Japonais
  JP: "ja",
  // Coréen
  KR: "ko", KP: "ko",
  // Anglais — défaut explicite pour les grands pays anglophones
  US: "en", GB: "en", CA: "en", AU: "en", NZ: "en", IE: "en", NG: "en",
  GH: "en", KE: "en", UG: "en", TZ: "en", ZA: "en", ZW: "en", ZM: "en",
  MW: "en", LR: "en", SL: "en", GM: "en", BW: "en", NA: "en", PH: "en",
  IN: "en", PK: "en", BD: "en", LK: "en", MY: "en", ID: "en", JM: "en",
  TT: "en", BS: "en", BB: "en", GY: "en", BZ: "en", FJ: "en", PG: "en",
  SS: "en", ET: "en", ER: "en", NL: "en", DK: "en", SE: "en", NO: "en",
  FI: "en", IS: "en", PL: "en", CZ: "en", SK: "en", HU: "en", RO: "en",
  BG: "en", GR: "en", HR: "en", SI: "en", RS: "en", BA: "en", MK: "en",
  AL: "en", ME: "en", XK: "en", LT: "en", LV: "en", EE: "en", CY: "en",
  MT: "en", TR: "en", IR: "en", AF: "en", TH: "en", VN: "en", KH: "en",
  LA: "en", MM: "en", MN: "en", NP: "en", BT: "en", MV: "en", BN: "en",
};

export function localePourPays(pays: string | undefined | null): Locale {
  if (!pays) return LOCALE_PAR_DEFAUT;
  return PAYS_LANGUE[pays.toUpperCase()] ?? LOCALE_PAR_DEFAUT;
}

/**
 * Meilleure locale d'après l'en-tête Accept-Language.
 * Parcourt les langues par ordre de préférence du navigateur.
 */
export function localePourAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  for (const partie of header.split(",")) {
    const code = partie.split(";")[0]?.trim().toLowerCase().slice(0, 2);
    if (estLocale(code)) return code;
  }
  return null;
}

/**
 * Enveloppe un identifiant pour qu'il garde sa direction propre à
 * l'intérieur d'une phrase. Sans cela, dans une phrase arabe ou hébraïque,
 * l'arobase — caractère neutre — suit la direction de la phrase et se pose
 * après le nom : « selah_lumiere@ ».
 */
export function pseudo(nom: string): string {
  return `\u2066@${nom}\u2069`;
}
