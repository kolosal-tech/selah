import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  WEB_VITAL_METRICS,
  bucketPourVital,
  recordAnonymousEvent,
  type WebVitalMetric,
} from "@/lib/analytics/anonymous";
import {
  PRODUCT_EVENT_SURFACES,
  type ProductEventSurface,
} from "@/lib/analytics/events";

/**
 * Collecte des métriques terrain (LCP, INP, CLS).
 *
 * Le navigateur envoie une valeur brute ; le serveur la réduit à l'un des trois
 * paliers de web.dev avant écriture. Rien de ce que le client affirme n'est
 * conservé tel quel : ni la valeur, ni l'URL, ni un identifiant. Un client
 * hostile ne peut donc que fausser un compteur, jamais déposer une empreinte.
 *
 * Cette route est sous `/api/`, que `isPublicPath` fait échapper à la garde
 * globale du proxy : elle est délibérément accessible sans session, puisqu'une
 * page de connexion lente est exactement ce qu'il faut mesurer.
 */
export async function POST(request: Request) {
  const charge = (await request.json().catch(() => ({}))) as {
    metric?: string;
    value?: number;
    surface?: string;
  };

  const metric = WEB_VITAL_METRICS.find((m) => m === charge.metric) as
    | WebVitalMetric
    | undefined;
  const surface = PRODUCT_EVENT_SURFACES.find((s) => s === charge.surface) as
    | ProductEventSurface
    | undefined;
  if (!metric || !surface || typeof charge.value !== "number") {
    return new NextResponse(null, { status: 204 });
  }

  const bucket = bucketPourVital(metric, charge.value);
  if (!bucket) return new NextResponse(null, { status: 204 });

  const supabase = await supabaseServer();
  await recordAnonymousEvent(supabase, {
    name: "web_vital",
    surface,
    metric,
    bucket,
  });

  // 204 systématique : la réponse ne dit jamais si la mesure a été retenue, ce
  // qui éviterait à un appelant de sonder la présence du jeton serveur.
  return new NextResponse(null, { status: 204 });
}
