"use client";

import { useState } from "react";
import Link from "next/link";
import { createPrayerRequest, prayNow } from "@/app/actions";
import { HeartHandshake, Send, Sparkles, CheckCircle2, Headphones } from "lucide-react";
import { useMessages } from "@/i18n/client";

export interface PrayerItem {
  id: string;
  body: string;
  anonymous: boolean;
  answered: boolean;
  pray_count: number;
  created_at: string;
  username: string | null;
}

export function PrayerClientView({ initialRequests }: { initialRequests: PrayerItem[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [glowingHaloId, setGlowingHaloId] = useState<string | null>(null);
  const m = useMessages();

  const handlePray = async (id: string) => {
    // Halo glow effect
    setGlowingHaloId(id);
    setTimeout(() => setGlowingHaloId(null), 1800);

    // Optimistic intercessor update
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, pray_count: r.pray_count + 1 } : r))
    );

    try {
      await prayNow(id);
    } catch {}
  };

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">{m.priere.titre}</h1>
        <p className="mt-1 text-sm text-white/70">{m.priere.sousTitre}</p>
      </div>

      <Link
        href="/rooms"
        className="glass-card flex items-center justify-between gap-4 p-4 transition hover:border-teal-300/30 hover:bg-white/10"
      >
        <span className="flex items-center gap-3">
          <Headphones className="h-5 w-5 text-teal-300" />
          <span>
            <strong className="block text-sm text-white">{m.rooms.audioTitre}</strong>
            <span className="text-xs text-white/55">{m.rooms.audioPilote}</span>
          </span>
        </span>
        <span className="text-xs font-semibold text-amber-200">{m.rooms.seJoindre} →</span>
      </Link>

      <form
        action={createPrayerRequest}
        className="glass-card p-5 space-y-4 shadow-2xl relative overflow-hidden group"
      >
        <div className="absolute -top-10 -end-10 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        <textarea
          name="body"
          required
          rows={3}
          placeholder={m.priere.placeholder}
          className="glass-input w-full rounded-2xl p-4 text-sm placeholder:text-white/40 resize-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 text-xs text-white/80 cursor-pointer select-none">
            <input
              type="checkbox"
              name="anonymous"
              className="h-4 w-4 rounded border-white/20 bg-white/10 text-amber-500 focus:ring-amber-500/50"
            />
            <span>{m.priere.anonyme}</span>
          </label>

          <button className="flex items-center gap-2 rounded-full btn-paradise px-6 py-2.5 text-xs font-bold hover:scale-105 active:scale-95 transition">
            <Send className="h-4 w-4" />
            <span>{m.priere.deposer}</span>
          </button>
        </div>
      </form>

      {/* Glassmorphic Prayer Cards */}
      <div className="space-y-4">
        {requests.map((r) => {
          const isGlowing = glowingHaloId === r.id;

          return (
            <article
              key={r.id}
              className="prayer-card glass-card glass-card-hover relative space-y-3 overflow-hidden p-5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300">
                  {r.anonymous
                    ? m.priere.discipleAnonyme
                    : `@${r.username ?? m.commun.frere}`}
                </span>
                {r.answered && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-[11px] font-semibold text-emerald-300 shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{m.priere.exauce}</span>
                  </span>
                )}
              </div>

              <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                {r.body}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handlePray(r.id)}
                  aria-label={m.priere.priePourToi}
                  aria-pressed={isGlowing}
                  className={`relative flex items-center gap-2.5 rounded-full px-5 py-2 text-xs font-bold transition-all duration-300 ${
                    isGlowing
                      ? "bg-amber-400 text-slate-950 shadow-[0_0_30px_10px_rgba(245,158,11,0.6)] scale-105 prayer-halo"
                      : "bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-200 border border-amber-500/30 hover:bg-amber-500/30"
                  }`}
                >
                  <HeartHandshake className="h-4 w-4 text-amber-300" />
                  <span>{m.priere.priePourToi}</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    <strong className="text-amber-300 font-bold">{r.pray_count}</strong>{" "}
                    {m.priere.intercesseurs(r.pray_count)}
                  </span>
                </div>
              </div>
            </article>
          );
        })}

        {requests.length === 0 && (
          <div className="glass-card p-10 text-center space-y-2">
            <HeartHandshake className="h-10 w-10 text-amber-400 mx-auto opacity-70" />
            <p className="text-sm font-medium text-white/70">{m.priere.vide}</p>
          </div>
        )}
      </div>
    </main>
  );
}
