import { supabaseServer } from "@/lib/supabase/server";
import { createChallenge, checkInChallenge } from "@/app/actions";
import { defiEnCours, jourDuDefi, progression } from "@/lib/challenge";
import { isoDay } from "@/lib/streak";
import { Trophy, CheckCircle, Plus, Users } from "lucide-react";

export default async function Challenges() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const aujourdhui = isoDay(new Date());

  const [{ data: defis }, { data: pointages }] = await Promise.all([
    supabase.from("challenges").select("*").order("starts_on", { ascending: false }).limit(30),
    supabase.from("challenge_checkins").select("challenge_id, user_id, day"),
  ]);

  const mesJours = new Map<string, number>();
  const participants = new Map<string, Set<string>>();
  for (const p of pointages ?? []) {
    if (p.user_id === user?.id) {
      mesJours.set(p.challenge_id, (mesJours.get(p.challenge_id) ?? 0) + 1);
    }
    if (!participants.has(p.challenge_id)) participants.set(p.challenge_id, new Set());
    participants.get(p.challenge_id)!.add(p.user_id);
  }
  const pointeAujourdhui = new Set(
    (pointages ?? [])
      .filter((p) => p.user_id === user?.id && p.day === aujourdhui)
      .map((p) => p.challenge_id),
  );

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">Défis Communautaires</h1>
        <p className="mt-1 text-sm text-white/70">
          21 jours de prière, 40 jours dans la Parole… Grandissons ensemble.
        </p>
      </div>

      {/* Translucent Create Challenge Form */}
      <form
        action={createChallenge}
        className="glass-card p-5 space-y-4 shadow-2xl relative overflow-hidden"
      >
        <input
          name="title"
          required
          minLength={3}
          placeholder="Titre du défi (ex. 21 jours de prière pour les nations)"
          className="glass-input w-full rounded-2xl p-3.5 text-sm placeholder:text-white/40"
        />
        <textarea
          name="description"
          rows={2}
          placeholder="Ce à quoi on s'engage chaque jour…"
          className="glass-input w-full rounded-2xl p-3.5 text-sm placeholder:text-white/40 resize-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60 font-medium">Jours :</span>
              <input
                name="days"
                type="number"
                min={1}
                max={365}
                defaultValue={21}
                className="glass-input w-20 rounded-xl p-2 text-center text-xs"
              />
            </div>
            <input
              name="starts_on"
              type="date"
              defaultValue={aujourdhui}
              className="glass-input rounded-xl p-2 text-xs text-white/80"
            />
          </div>

          <button className="flex items-center gap-2 rounded-full btn-paradise px-6 py-2.5 text-xs font-bold hover:scale-105 transition">
            <Plus className="h-4 w-4" />
            <span>Lancer le défi</span>
          </button>
        </div>
      </form>

      {/* Dark Glass Challenge Cards */}
      <div className="space-y-4">
        {(defis ?? []).map((d) => {
          const faits = mesJours.get(d.id) ?? 0;
          const pct = progression(faits, d.days);
          const enCours = defiEnCours(d, aujourdhui);
          const jour = jourDuDefi(d, aujourdhui);
          const isDoneToday = pointeAujourdhui.has(d.id);

          return (
            <article
              key={d.id}
              className="glass-card glass-card-hover p-6 space-y-4 relative overflow-hidden"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{d.title}</h2>
                  {d.description && (
                    <p className="mt-1 text-xs text-white/70 leading-relaxed">{d.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/60 font-medium border border-white/10">
                  <Users className="h-3.5 w-3.5 text-amber-400" />
                  <span>{participants.get(d.id)?.size ?? 0}</span>
                </div>
              </div>

              {/* Progress section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300">
                    {enCours ? `Jour ${jour} / ${d.days}` : jour === 0 ? "À venir" : "Terminé"}
                  </span>
                  <span className="text-white/60">
                    Avancement : <strong className="text-emerald-400">{pct}%</strong> ({faits}/{d.days}j)
                  </span>
                </div>

                {/* Glowing gradient progress bar (emerald to amber) */}
                <div className="h-3.5 w-full rounded-full bg-black/50 overflow-hidden p-0.5 border border-white/10 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400 shadow-[0_0_12px_rgba(52,211,153,0.6)] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Action Button */}
              {enCours && (
                <form action={checkInChallenge.bind(null, d.id)} className="pt-2">
                  <button
                    disabled={isDoneToday}
                    className={`w-full flex items-center justify-center gap-2 rounded-full py-3 text-xs font-bold transition-all duration-300 ${
                      isDoneToday
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-default"
                        : "btn-paradise hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                  >
                    <CheckCircle className={`h-4 w-4 ${isDoneToday ? "text-emerald-400" : "text-amber-300"}`} />
                    <span>{isDoneToday ? "Fait aujourd'hui ✨" : "Je l'ai fait aujourd'hui"}</span>
                  </button>
                </form>
              )}
            </article>
          );
        })}

        {(defis ?? []).length === 0 && (
          <div className="glass-card p-10 text-center space-y-2">
            <Trophy className="h-10 w-10 text-amber-400 mx-auto opacity-70" />
            <p className="text-sm font-medium text-white/70">
              Aucun défi disponible pour l&apos;instant. Sois l&apos;étincelle qui lance le premier ! 🔥
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

