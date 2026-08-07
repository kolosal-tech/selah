import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { openPrayerRoom } from "@/app/actions";
import { Radio, Plus, Users } from "lucide-react";

/** Barres de l'onde sonore : hauteurs déterministes (pas de rendu aléatoire
 *  divergent entre serveur et client). */
const ONDE = Array.from({ length: 30 }, (_, i) =>
  Math.round(8 + Math.abs(Math.sin(i * 1.1)) * 24),
);

export default async function Rooms() {
  const supabase = await supabaseServer();
  const { data: rooms } = await supabase
    .from("prayer_rooms")
    .select("*, profiles!prayer_rooms_host_id_fkey(username)")
    .is("closed_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <main className="flex flex-col gap-6">
      {/* En-tête « Direct / Upper Room » — une seule ligne, comme la maquette */}
      <div>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[26px] font-bold tracking-tight text-rose-400">Direct</span>
          <span className="text-[26px] font-light text-white/40">/</span>
          <span className="text-[26px] font-bold tracking-tight text-teal-300">Upper Room</span>
        </div>
        <p className="mt-1 text-sm text-white/70">
          Salles de prière et d&apos;intercession en direct. On entre, on s&apos;unit dans l&apos;Esprit. (Actes 1:13-14)
        </p>
      </div>

      {/* Ouvrir une salle */}
      <form
        action={openPrayerRoom}
        className="glass-card relative overflow-hidden p-5 shadow-2xl"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            name="title"
            required
            minLength={3}
            placeholder="Titre de la salle (ex. Veillée pour le Sahel)"
            className="glass-input flex-1 rounded-2xl p-3 text-sm placeholder:text-white/40"
          />
          <input
            name="topic"
            placeholder="Sujet"
            className="glass-input rounded-2xl p-3 text-sm placeholder:text-white/40 sm:w-1/3"
          />
          <button className="flex items-center justify-center gap-2 rounded-full bg-gradient-gold-turquoise px-6 py-3 text-xs font-bold text-slate-950 shadow-lg transition hover:scale-105">
            <Plus className="h-4 w-4" />
            <span>Ouvrir</span>
          </button>
        </div>
      </form>

      {/* Cartes de salles en direct */}
      <div className="grid gap-6">
        {(rooms ?? []).map((r, idx) => {
          const hote = r.profiles?.username ?? "disciple";
          return (
            <Link
              key={r.id}
              href={`/rooms/${r.id}`}
              className="glass-card glass-card-hover group relative block overflow-visible px-5 pb-5 pt-6"
            >
              <span className="pastille-direct">● EN DIRECT</span>

              <h3 className="text-[19px] font-bold text-white transition group-hover:text-amber-300">
                {r.title}
              </h3>
              <p className="mt-1 text-xs text-white/60">
                {r.topic || "Prière libre"} · Animée par{" "}
                <strong className="text-amber-300">@{hote}</strong>
              </p>

              {/* Intervenants, halo doré */}
              <div className="mt-5 flex items-center justify-around">
                <div className="flex flex-col items-center gap-2">
                  <span className="halo-orateur flex h-[72px] w-[72px] items-center justify-center rounded-full bg-amber-500/25 text-lg font-bold text-amber-200">
                    {hote[0]?.toUpperCase() ?? "S"}
                  </span>
                  <span className="text-sm font-semibold text-white">@{hote}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="halo-orateur flex h-[72px] w-[72px] items-center justify-center rounded-full bg-amber-500/25 text-lg font-bold text-amber-200">
                    I
                  </span>
                  <span className="text-sm font-semibold text-white">Intercesseurs</span>
                </div>
              </div>

              {/* Onde sonore pulsée */}
              <div className="mt-4 flex h-[34px] items-end justify-center gap-[3px]">
                {ONDE.map((h, i) => (
                  <span
                    key={i}
                    className={`w-[3px] rounded-full bg-amber-400 animate-soundwave-${(i % 4) + 1}`}
                    style={{ height: `${h}px`, opacity: 0.45 + h / 60 }}
                  />
                ))}
              </div>

              {/* Pied de carte : auditeurs + rejoindre */}
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="flex items-center gap-2 text-xs text-white/60">
                  <Users className="h-4 w-4" />
                  <span>{12 + idx * 7} auditeurs</span>
                </span>
                <span className="rounded-full bg-gradient-to-r from-amber-200 to-teal-300 px-6 py-2.5 text-[15px] font-bold text-slate-950 shadow-[0_0_22px_rgba(94,234,212,0.3)] transition group-hover:scale-105">
                  Se Joindre
                </span>
              </div>
            </Link>
          );
        })}

        {(rooms ?? []).length === 0 && (
          <div className="glass-card space-y-2 p-10 text-center">
            <Radio className="mx-auto h-10 w-10 animate-pulse text-amber-400 opacity-70" />
            <p className="text-sm font-medium text-white/70">
              Aucune salle ouverte en ce moment. Ouvre la première et rassemble les disciples. 🕯️
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
