import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEnabled } from "@/lib/flags";
import type { ProductEvent } from "@/lib/analytics/events";

/**
 * Émission d'un événement produit.
 *
 * Deux propriétés non négociables :
 *  - une mesure ne casse jamais un parcours (toute erreur est absorbée) ;
 *  - une mesure ne journalise rien (un `console.error` ici finirait par
 *    recopier des identifiants dans les logs d'exploitation).
 *
 * L'attribution de l'acteur est faite en base par `auth.uid()` : aucun
 * identifiant n'est transmis depuis l'application, donc aucun appelant ne peut
 * écrire au nom d'un autre compte.
 */
export async function recordProductEvent(
  supabase: SupabaseClient,
  event: ProductEvent,
): Promise<void> {
  if (!isEnabled("analytics")) return;
  try {
    await supabase.rpc("record_product_event", {
      p_name: event.name,
      p_surface: event.surface,
      p_outcome: event.outcome ?? "ok",
      p_reason: event.reason ?? "none",
    });
  } catch {
    // Silence délibéré : voir le contrat ci-dessus.
  }
}

/**
 * Variante hors chemin critique : la réponse est envoyée, puis l'événement
 * part. Un aller-retour Postgres de mesure ne doit pas allonger un rendu.
 */
export function recordProductEventAfter(
  supabase: SupabaseClient,
  event: ProductEvent,
): void {
  if (!isEnabled("analytics")) return;
  after(() => recordProductEvent(supabase, event));
}
