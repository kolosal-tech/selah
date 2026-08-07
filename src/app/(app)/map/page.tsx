import { supabaseServer } from "@/lib/supabase/server";
import { Globe2, HeartHandshake } from "lucide-react";

const FLAGS: Record<string, string> = {};
function flag(cc: string) {
  if (!FLAGS[cc]) {
    FLAGS[cc] = cc
      .toUpperCase()
      .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  }
  return FLAGS[cc];
}

export default async function IntercessionMap() {
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("intercession_map")
    .select("*")
    .order("prayers_24h", { ascending: false });

  const total = (rows ?? []).reduce((s, r) => s + r.prayers_24h, 0);
  const max = Math.max(1, ...(rows ?? []).map((r) => r.prayers_24h));

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Globe2 className="h-6 w-6 text-emerald-400" />
          <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">Carte d&apos;intercession</h1>
        </div>
        <p className="mt-1 text-sm text-white/70">
          <strong className="text-gradient-paradise font-extrabold text-base">{total}</strong> prières portées ces dernières 24 h à travers le monde.
        </p>
      </div>

      {/* Country List */}
      <div className="space-y-3">
        {(rows ?? []).map((r) => (
          <div
            key={r.country}
            className="glass-card glass-card-hover p-4 flex items-center gap-4"
          >
            <span className="text-3xl drop-shadow">{flag(r.country)}</span>

            {/* Progress bar */}
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-white">{r.country}</span>
                <span className="text-amber-300 font-bold">{r.prayers_24h} prières</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-black/40 overflow-hidden p-0.5 border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                  style={{ width: `${(r.prayers_24h / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        {(rows ?? []).length === 0 && (
          <div className="glass-card p-10 text-center space-y-2">
            <HeartHandshake className="h-10 w-10 text-amber-400 mx-auto opacity-70" />
            <p className="text-sm font-medium text-white/70">
              La carte s&apos;allumera dès la première prière. Va sur le mur de prière. 🌍
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

