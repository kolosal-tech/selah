import type { Locale } from "../config";
import { fr, type Messages } from "./fr";
import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";
import { it } from "./it";
import { de } from "./de";
import { ru } from "./ru";
import { ar } from "./ar";
import { he } from "./he";
import { zh } from "./zh";
import { ja } from "./ja";
import { ko } from "./ko";

export type { Messages };

export const MESSAGES: Record<Locale, Messages> = {
  fr,
  en,
  es,
  pt,
  it,
  de,
  ru,
  ar,
  he,
  zh,
  ja,
  ko,
};
