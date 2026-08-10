import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { openPrayerRoom } from "@/app/actions";
import { Radio, Plus, Headphones, Bell } from "lucide-react";
import { getMessages } from "@/i18n/server";

/** Onde sonore : hauteurs déterministes (même rendu serveur et client). */
const ONDE = Array.from({ length: 9 }, (_, i) =>
  Math.round(10 + Math.abs(Math.sin(i * 1.7)) * 30),
);

function Onde() {
  return (
    <div className="flex h-11 flex-1 items-center gap-[2px] overflow-hidden">
      {ONDE.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] shrink-0 rounded-full bg-amber-300 animate-soundwave-${(i % 4) + 1}`}
          style={{ height: `${h}px`, opacity: 0.5 + h / 80 }}
        />
      ))}
    </div>
  );
}

export default async function Rooms() {
  const supabase = await supabaseServer();
  const m = await getMessages();
  const { data: rooms } = await supabase
    .from("prayer_rooms")
    .select("*, profiles!prayer_rooms_host_id_fkey(username)")
    .is("closed_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <main className="flex flex-col gap-5">
      {/* En-tête : titre large corail / turquoise + cloche de notifications */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2 whitespace-nowrap text-[26px] font-semibold tracking-tight">
          <span className="text-rose-400">{m.rooms.titre}</span>
          <span className="font-light text-white/40">/</span>
          <span className="text-teal-300">{m.rooms.upperRoom}</span>
        </div>
        <span className="relative mt-1 shrink-0 text-white/80">
          <Bell className="h-[22px] w-[22px]" />
          <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />
        </span>
      </div>
      <p className="-mt-3 text-sm text-white/70">{m.rooms.sousTitre}</p>

      {/* Ouvrir une salle */}
      <form action={openPrayerRoom} className="glass-card relative overflow-hidden p-5 shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            name="title"
            required
            minLength={3}
            placeholder={m.rooms.titrePlaceholder}
            className="glass-input flex-1 rounded-2xl p-3 text-sm placeholder:text-white/40"
          />
          <input
            name="topic"
            placeholder={m.rooms.sujetPlaceholder}
            className="glass-input rounded-2xl p-3 text-sm placeholder:text-white/40 sm:w-1/3"
          />
          <button className="flex items-center justify-center gap-2 rounded-full bg-gradient-gold-turquoise px-6 py-3 text-xs font-bold text-slate-950 shadow-lg transition hover:scale-105">
            <Plus className="h-4 w-4" />
            <span>{m.rooms.ouvrir}</span>
          </button>
        </div>
      </form>

      {/* Cartes de salles en direct */}
      <div className="grid gap-6 pt-3">
        {(rooms ?? []).map((r) => {
          const hote = r.profiles?.username ?? m.commun.disciple;
          return (
            <Link
              key={r.id}
              href={`/rooms/${r.id}`}
              className="carte-direct group relative block px-[18px] pb-[18px] pt-6"
            >
              <span className="pastille-direct">{m.rooms.enDirect}</span>

              <h3 className="text-xl font-semibold tracking-tight text-white transition group-hover:text-amber-200">
                {r.title}
              </h3>

              {/* Intervenants encadrés par l'onde sonore, halos dorés */}
              <div className="mt-[18px] flex items-center justify-between gap-1">
                <Onde />
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <span className="halo-orateur flex h-[76px] w-[76px] items-center justify-center rounded-full bg-amber-500/25 text-lg font-bold text-amber-100">
                    {hote[0]?.toUpperCase() ?? "S"}
                  </span>
                  <span className="whitespace-nowrap text-[15px] font-medium text-white">@{hote}</span>
                </div>
                <Onde />
                <div className="mt-[26px] flex shrink-0 flex-col items-center gap-2">
                  <span className="halo-orateur flex h-[76px] w-[76px] items-center justify-center rounded-full bg-amber-500/25 text-lg font-bold text-amber-100">
                    {m.rooms.intercesseurs[0]}
                  </span>
                  <span className="whitespace-nowrap text-[15px] font-medium text-white">
                    {m.rooms.intercesseurs}
                  </span>
                </div>
              </div>

              {/* Commentaires live */}
              <div className="mt-[18px] flex flex-col gap-2">
                <p className="text-[13px] text-white/70">
                  {r.topic || m.rooms.priereLibre} · {m.rooms.animeePar}{" "}
                  <strong className="text-amber-300">@{hote}</strong>
                </p>
                <p className="text-[13px] text-white/45">{m.rooms.commentairesLive}</p>
              </div>

              {/* Pied de carte */}
              <div className="mt-3.5 flex items-center justify-between border-t border-white/10 pt-3.5">
                <span className="flex items-center gap-2 text-[13px] text-white/60">
                  <Headphones className="h-4 w-4" />
                  <span>{m.rooms.audioPilote}</span>
                </span>
                <span className="rounded-full bg-gradient-to-r from-amber-200 to-teal-300 px-[26px] py-2.5 text-[15px] font-bold text-slate-950 shadow-[0_0_22px_rgba(94,234,212,0.3)] transition group-hover:scale-105">
                  {m.rooms.seJoindre}
                </span>
              </div>
            </Link>
          );
        })}

        {(rooms ?? []).length === 0 && (
          <div className="glass-card space-y-2 p-10 text-center">
            <Radio className="mx-auto h-10 w-10 animate-pulse text-amber-400 opacity-70" />
            <p className="text-sm font-medium text-white/70">{m.rooms.vide}</p>
          </div>
        )}
      </div>
    </main>
  );
}
