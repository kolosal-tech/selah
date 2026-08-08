import { supabaseServer } from "@/lib/supabase/server";
import { createChallenge, checkInChallenge } from "@/app/actions";
import { defiEnCours, jourDuDefi, progression } from "@/lib/challenge";
import { isoDay } from "@/lib/streak";
import { Trophy, CheckCircle, Plus, Users, ChevronRight, Check } from "lucide-react";

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

  /** Les 3 derniers jours du défi principal, pour la rangée « Défis quotidiens ». */
  const principal = (defis ?? []).find((d) => defiEnCours(d, aujourdhui)) ?? (defis ?? [])[0];
  const joursPointes = new Set(
    (pointages ?? [])
      .filter((p) => p.user_id === user?.id && p.challenge_id === principal?.id)
      .map((p) => p.day),
  );
  const troisDerniers = [2, 1, 0].map((recul) => {
    const d = new Date();
    d.setDate(d.getDate() - recul);
    const jour = isoDay(d);
    return { jour, fait: joursPointes.has(jour), aujourdhui: jour === aujourdhui };
  });

  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold tracking-tight text-white">Défis</h1>

      {/* Défi principal — carte dorée de la maquette */}
      {principal && (
        <section className="rounded-[22px] border border-amber-400/35 bg-gradient-to-br from-amber-400/[0.22] to-amber-400/[0.06] p-[18px] shadow-[0_0_30px_rgba(245,158,11,0.15)]">
          <div className="flex items-center justify-between gap-3">
            <span className="whitespace-nowrap text-[17px] font-bold text-white">
              {principal.title}
            </span>
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-amber-300">
              {defiEnCours(principal, aujourdhui) ? "En cours" : "Terminé"}
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.6)] transition-all duration-500"
              style={{
                width: `${progression(mesJours.get(principal.id) ?? 0, principal.days)}%`,
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-white/70">
              Jour {jourDuDefi(principal, aujourdhui)} / {principal.days}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
              <Users className="h-3.5 w-3.5 text-amber-400" />
              {participants.get(principal.id)?.size ?? 0}
            </span>
          </div>
        </section>
      )}

      {/* Défis quotidiens — pastilles des 3 derniers jours */}
      {principal && (
        <section className="rounded-[20px] border border-white/10 bg-white/5 px-[18px] py-4">
          <h2 className="mb-3 text-[17px] font-bold text-white">Défis quotidiens</h2>
          <div className="flex gap-2.5">
            {troisDerniers.map((j) => (
              <span
                key={j.jour}
                title={j.jour}
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-full border ${
                  j.aujourdhui
                    ? "border-amber-400/70 bg-amber-400/30 text-amber-300"
                    : j.fait
                      ? "border-emerald-400/80 bg-emerald-400/30 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.35)]"
                      : "border-emerald-400/40 bg-white/5 text-emerald-300/50"
                }`}
              >
                <Check className="h-[17px] w-[17px]" />
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Créer un défi */}
      <form
        action={createChallenge}
        className="glass-card relative space-y-4 overflow-hidden p-5 shadow-2xl"
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
          className="glass-input w-full resize-none rounded-2xl p-3.5 text-sm placeholder:text-white/40"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/60">Jours :</span>
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

          <button className="btn-paradise flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold transition hover:scale-105">
            <Plus className="h-4 w-4" />
            <span>Lancer le défi</span>
          </button>
        </div>
      </form>

      {/* Tous les défis */}
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
              className="glass-card glass-card-hover relative space-y-4 overflow-hidden p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">{d.title}</h2>
                  {d.description && (
                    <p className="mt-1 text-xs leading-relaxed text-white/70">{d.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white/60">
                  <Users className="h-3.5 w-3.5 text-amber-400" />
                  <span>{participants.get(d.id)?.size ?? 0}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300">
                    {enCours ? `Jour ${jour} / ${d.days}` : jour === 0 ? "À venir" : "Terminé"}
                  </span>
                  <span className="text-white/60">
                    Ton avancement : <strong className="text-emerald-400">{faits} / {d.days} jours</strong>
                  </span>
                </div>

                <div className="h-3.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/50 p-0.5 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400 shadow-[0_0_12px_rgba(52,211,153,0.6)] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {enCours && (
                <form action={checkInChallenge.bind(null, d.id)} className="pt-2">
                  <button
                    disabled={isDoneToday}
                    className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-xs font-bold transition-all duration-300 ${
                      isDoneToday
                        ? "cursor-default border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
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
          <div className="glass-card space-y-2 p-10 text-center">
            <Trophy className="mx-auto h-10 w-10 text-amber-400 opacity-70" />
            <p className="text-sm font-medium text-white/70">
              Aucun défi disponible pour l&apos;instant. Sois l&apos;étincelle qui lance le premier ! 🔥
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
