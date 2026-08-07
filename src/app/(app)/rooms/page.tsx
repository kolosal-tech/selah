import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { openPrayerRoom } from "@/app/actions";
import { Radio, Plus, Users } from "lucide-react";

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
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight text-gradient-gold">Direct</span>
          <span className="text-2xl font-light text-white/30">/</span>
          <span className="text-2xl font-black tracking-tight text-gradient-paradise">Upper Room</span>
        </div>
        <p className="mt-1 text-sm text-white/70">
          Salles de prière et d&apos;intercession en direct. On entre, on s&apos;unit dans l&apos;Esprit. (Actes 1:13-14)
        </p>
      </div>

      {/* Translucent Create Room Input */}
      <form
        action={openPrayerRoom}
        className="glass-card p-5 space-y-3 shadow-2xl relative overflow-hidden"
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
          <button className="flex items-center justify-center gap-2 rounded-full bg-gradient-gold-turquoise px-6 py-3 text-xs font-bold text-slate-950 shadow-lg hover:scale-105 transition">
            <Plus className="h-4 w-4" />
            <span>Ouvrir</span>
          </button>
        </div>
      </form>

      {/* Live Room Glass Cards */}
      <div className="grid gap-4">
        {(rooms ?? []).map((r, idx) => (
          <Link
            key={r.id}
            href={`/rooms/${r.id}`}
            className="glass-card glass-card-hover p-6 relative overflow-hidden group block"
          >
            {/* Ambient Background Glow for cards */}
            <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-rose-500/10 blur-2xl group-hover:bg-rose-500/20 transition-all pointer-events-none" />

            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition">
                    {r.title}
                  </h3>
                  {/* Blinking neon green/coral LIVE badge */}
                  <span className="flex items-center gap-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                    <span>• EN DIRECT</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/60">
                  {r.topic || "Prière libre"} · Animée par{" "}
                  <strong className="text-amber-300">@{r.profiles?.username}</strong>
                </p>
              </div>
            </div>

            {/* Pulsing Gold/Turquoise sound wave visualizer & participant avatars */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
              {/* Participant Avatars with Glowing Aura */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-3">
                  <div className="relative h-10 w-10 rounded-full border-2 border-amber-400 bg-amber-500/30 flex items-center justify-center font-bold text-xs text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                    A
                  </div>
                  <div className="relative h-10 w-10 rounded-full border-2 border-teal-400 bg-teal-500/30 flex items-center justify-center font-bold text-xs text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.5)]">
                    G
                  </div>
                </div>

                {/* Animated Sound Wave Visualizer */}
                <div className="flex items-center gap-1 h-8 px-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/10">
                  <span className="w-1 bg-gradient-to-t from-amber-400 to-emerald-400 rounded-full animate-soundwave-1" />
                  <span className="w-1 bg-gradient-to-t from-amber-400 to-emerald-400 rounded-full animate-soundwave-2" />
                  <span className="w-1 bg-gradient-to-t from-amber-400 to-emerald-400 rounded-full animate-soundwave-3" />
                  <span className="w-1 bg-gradient-to-t from-amber-400 to-emerald-400 rounded-full animate-soundwave-4" />
                </div>
              </div>

              {/* Quick-Join Button */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-white/50">
                  <Users className="h-3.5 w-3.5" />
                  <span>{12 + idx * 7} auditeurs</span>
                </div>
                <button className="rounded-full bg-gradient-to-r from-amber-400 to-teal-400 px-5 py-2 text-xs font-bold text-slate-950 shadow-lg hover:scale-105 transition">
                  Se Joindre
                </button>
              </div>
            </div>
          </Link>
        ))}

        {(rooms ?? []).length === 0 && (
          <div className="glass-card p-10 text-center space-y-2">
            <Radio className="h-10 w-10 text-amber-400 mx-auto opacity-70 animate-pulse" />
            <p className="text-sm font-medium text-white/70">
              Aucune salle ouverte en ce moment. Ouvre la première et rassemble les disciples. 🕯️
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

