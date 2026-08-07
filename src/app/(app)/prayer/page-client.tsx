"use client";

import { useState } from "react";
import { createPrayerRequest, prayNow } from "@/app/actions";
import { HeartHandshake, Send, Sparkles, CheckCircle2 } from "lucide-react";

export interface PrayerItem {
  id: string;
  body: string;
  anonymous: boolean;
  answered: boolean;
  pray_count: number;
  created_at: string;
  profiles?: { username: string } | null;
}

export function PrayerClientView({ initialRequests }: { initialRequests: PrayerItem[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [glowingHaloId, setGlowingHaloId] = useState<string | null>(null);

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
        <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">Mur de Prière</h1>
        <p className="mt-1 text-sm text-white/70">
          Dépose tes sujets et intercède pour la communauté mondiale.
        </p>
      </div>

      {/* Translucent Top Input Container with Gradient Gold/Coral Submit Button */}
      <form
        action={createPrayerRequest}
        className="glass-card p-5 space-y-4 shadow-2xl relative overflow-hidden group"
      >
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        <textarea
          name="body"
          required
          rows={3}
          placeholder="Dépose ton sujet de prière en toute confiance…"
          className="glass-input w-full rounded-2xl p-4 text-sm placeholder:text-white/40 resize-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 text-xs text-white/80 cursor-pointer select-none">
            <input
              type="checkbox"
              name="anonymous"
              className="h-4 w-4 rounded border-white/20 bg-white/10 text-amber-500 focus:ring-amber-500/50"
            />
            <span>Publier anonymement</span>
          </label>

          <button className="flex items-center gap-2 rounded-full btn-paradise px-6 py-2.5 text-xs font-bold hover:scale-105 active:scale-95 transition">
            <Send className="h-4 w-4" />
            <span>Déposer ma prière</span>
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
              className="glass-card glass-card-hover p-5 space-y-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300">
                  {r.anonymous ? "Disciple Anonyme" : `@${r.profiles?.username ?? "frère"}`}
                </span>
                {r.answered && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-[11px] font-semibold text-emerald-300 shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Exaucé ✨</span>
                  </span>
                )}
              </div>

              <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                {r.body}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                {/* Interactive "I'm praying for you" button with glowing golden halo effect */}
                <button
                  onClick={() => handlePray(r.id)}
                  className={`relative flex items-center gap-2.5 rounded-full px-5 py-2 text-xs font-bold transition-all duration-300 ${
                    isGlowing
                      ? "bg-amber-400 text-slate-950 shadow-[0_0_30px_10px_rgba(245,158,11,0.6)] scale-105 prayer-halo"
                      : "bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-200 border border-amber-500/30 hover:bg-amber-500/30"
                  }`}
                >
                  <HeartHandshake className="h-4 w-4 text-amber-300" />
                  <span>Je prie pour toi maintenant</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    <strong className="text-amber-300 font-bold">{r.pray_count}</strong>{" "}
                    {r.pray_count > 1 ? "intercesseurs" : "intercesseur"}
                  </span>
                </div>
              </div>
            </article>
          );
        })}

        {requests.length === 0 && (
          <div className="glass-card p-10 text-center space-y-2">
            <HeartHandshake className="h-10 w-10 text-amber-400 mx-auto opacity-70" />
            <p className="text-sm font-medium text-white/70">
              Aucune requête pour l&apos;instant. Sois le premier à déposer la tienne. 🙏
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

