import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Frein d'entrée sur les parcours non authentifiés.
 *
 * `consume_rate_limit` exige `auth.uid()`, nul avant authentification : les
 * écrans de connexion, d'inscription et de réinitialisation n'avaient donc
 * aucun frein applicatif. Le 13 août 2026, le plafond d'e-mails du fournisseur
 * a été atteint (`over_email_send_rate_limit`) sans qu'aucun garde-fou local
 * n'ait pu l'éviter.
 *
 * L'adresse cliente ne quitte jamais ce module : seul son condensé poivré est
 * transmis, et la base ne conserve que la fenêtre courante. Voir
 * `docs/adr/ADR-0014-frein-entree-auth.md`.
 */

export const AUTH_THROTTLE_SCOPES = ["login", "signup", "password_reset"] as const;

export type AuthThrottleScope = (typeof AUTH_THROTTLE_SCOPES)[number];

/**
 * Adresse cliente telle que Vercel la présente. `x-forwarded-for` peut porter
 * une chaîne de relais : la première entrée est le client, les suivantes sont
 * les proxys traversés.
 */
async function adresseCliente(): Promise<string | null> {
  const entetes = await headers();
  const transmise = entetes.get("x-forwarded-for");
  const premiere = transmise?.split(",")[0]?.trim();
  return premiere || entetes.get("x-real-ip") || null;
}

/**
 * Condensé poivré. Sans le secret serveur, un condensé ne se retourne pas :
 * l'espace des adresses IPv4 est assez petit pour être épuisé en force brute,
 * un SHA-256 nu ne protégerait donc rien.
 */
function condenser(adresse: string, poivre: string): string {
  return createHash("sha256").update(`${adresse}:${poivre}`, "utf8").digest("hex");
}

/**
 * Retourne `true` quand la tentative est autorisée.
 *
 * Politique d'ouverture assumée : sans secret serveur, sans adresse lisible ou
 * en cas de panne de la base, la tentative passe. Un frein anti-abus qui
 * bloquerait l'authentification lors d'un incident transformerait une gêne en
 * indisponibilité totale — la RLS et Supabase Auth restent les garde-fous durs.
 */
export async function consumeAuthAttempt(
  supabase: SupabaseClient,
  scope: AuthThrottleScope,
): Promise<boolean> {
  const poivre = process.env.SELAH_ANALYTICS_TOKEN;
  if (!poivre) return true;

  const adresse = await adresseCliente();
  if (!adresse) return true;

  try {
    const { data, error } = await supabase.rpc("consume_auth_attempt", {
      p_token: poivre,
      p_ip_hash: condenser(adresse, poivre),
      p_scope: scope,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}
