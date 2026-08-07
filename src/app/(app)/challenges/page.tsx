import { supabaseServer } from "@/lib/supabase/server";
import { createChallenge, checkInChallenge } from "@/app/actions";
import { defiEnCours, jourDuDefi, progression } from "@/lib/challenge";
import { isoDay } from "@/lib/streak";

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
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Défis communautaires</h1>
        <p className="text-stone-600">
          21 jours de prière, 40 jours dans la Parole, un jeûne collectif… On
          tient ensemble ce qu&apos;on ne tiendrait pas seul.
        </p>
      </div>

      <form
        action={createChallenge}
        className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
      >
        <input
          name="title"
          required
          minLength={3}
          placeholder="Titre (ex. 21 jours de prière pour les nations)"
          className="rounded-lg border border-stone-200 p-2 text-sm"
        />
        <textarea
          name="description"
          rows={2}
          placeholder="Ce à quoi on s'engage chaque jour"
          className="resize-none rounded-lg border border-stone-200 p-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="days"
            type="number"
            min={1}
            max={365}
            defaultValue={21}
            className="w-24 rounded-lg border border-stone-200 p-2 text-sm"
          />
          <input
            name="starts_on"
            type="date"
            defaultValue={aujourdhui}
            className="rounded-lg border border-stone-200 p-2 text-sm"
          />
          <button className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Lancer le défi
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {(defis ?? []).map((d) => {
          const faits = mesJours.get(d.id) ?? 0;
          const pct = progression(faits, d.days);
          const enCours = defiEnCours(d, aujourdhui);
          const jour = jourDuDefi(d, aujourdhui);
          return (
            <article
              key={d.id}
              className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-stone-900">{d.title}</h2>
                <span className="text-sm text-stone-500">
                  {participants.get(d.id)?.size ?? 0} participants
                </span>
              </div>
              {d.description && (
                <p className="mt-1 text-sm text-stone-600">{d.description}</p>
              )}
              <p className="mt-2 text-sm text-amber-700">
                {enCours ? `Jour ${jour} / ${d.days}` : jour === 0 ? "À venir" : "Terminé"}
              </p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-stone-500">
                Ton avancement : {faits} / {d.days} jours ({pct} %)
              </p>
              {enCours && (
                <form action={checkInChallenge.bind(null, d.id)} className="mt-3">
                  <button
                    disabled={pointeAujourdhui.has(d.id)}
                    className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                  >
                    {pointeAujourdhui.has(d.id)
                      ? "✓ Fait aujourd'hui"
                      : "Je l'ai fait aujourd'hui"}
                  </button>
                </form>
              )}
            </article>
          );
        })}
        {(defis ?? []).length === 0 && (
          <p className="text-center text-stone-400">
            Aucun défi. Lance le premier et entraîne l&apos;Église. 🔥
          </p>
        )}
      </div>
    </main>
  );
}
