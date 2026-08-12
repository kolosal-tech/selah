import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { AppealButton } from "./appeal-button";

type Sanction = { id: string; kind: "warning" | "mentorship_restriction"; reason: string; issued_at: string; expires_at: string | null; revoked_at: string | null };
export default async function SafetyPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: sanctions }, { data: appeals }] = await Promise.all([
    supabase.from("moderation_sanctions").select("id, kind, reason, issued_at, expires_at, revoked_at").order("issued_at", { ascending: false }),
    supabase.from("moderation_appeals").select("sanction_id, status"),
  ]);
  const appealBySanction = new Map((appeals ?? []).map((appeal) => [appeal.sanction_id, appeal.status]));
  return <main className="flex flex-col gap-6">
    <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300"><ShieldCheck className="h-4 w-4" /> Sécurité du compte</p><h1 className="mt-2 text-3xl font-bold text-white">Mes mesures de modération</h1><p className="mt-1 text-sm text-white/60">Les avertissements et restrictions sont examinés par une personne. Aucun bannissement automatique n’est appliqué.</p></div>
    {(sanctions ?? []).length === 0 ? <p className="glass-card p-5 text-sm text-white/65">Aucune mesure de modération n’est associée à ton compte.</p> : (sanctions as Sanction[]).map((sanction) => {
      const appeal = appealBySanction.get(sanction.id);
      const active = !sanction.revoked_at && (!sanction.expires_at || new Date(sanction.expires_at) > new Date());
      return <article key={sanction.id} className="glass-card p-5"><h2 className="font-bold text-white">{sanction.kind === "warning" ? "Avertissement" : "Restriction temporaire de mentorat"}</h2><p className="mt-1 text-sm text-white/65">Motif : {sanction.reason.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-white/50">{sanction.revoked_at ? "Révoquée" : sanction.expires_at ? `Active jusqu’au ${new Date(sanction.expires_at).toLocaleDateString()}` : "Mesure enregistrée"}</p>{active && !appeal && <AppealButton sanctionId={sanction.id} />}{appeal && <p className="mt-3 text-sm text-amber-200">Appel : {appeal === "pending" ? "en attente d’examen" : appeal === "upheld" ? "décision confirmée" : "décision renversée"}</p>}</article>;
    })}
  </main>;
}
