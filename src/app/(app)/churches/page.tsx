import { supabaseServer } from "@/lib/supabase/server";
import { addChurch } from "@/app/actions";
import { Building2, Plus, CheckCircle2, MapPin } from "lucide-react";

export default async function Churches() {
  const supabase = await supabaseServer();
  const { data: churches } = await supabase
    .from("churches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">Annuaire des églises</h1>
        <p className="mt-1 text-sm text-white/70">
          Référence ton église locale et fortifie la communion fraternelle.
        </p>
      </div>

      {/* Form */}
      <form
        action={addChurch}
        className="glass-card p-5 space-y-3 shadow-2xl relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            name="name"
            required
            placeholder="Nom de l'église (ex. Église Connexion)"
            className="glass-input flex-1 rounded-2xl p-3.5 text-sm placeholder:text-white/40"
          />
          <input
            name="city"
            placeholder="Ville"
            className="glass-input rounded-2xl p-3.5 text-sm placeholder:text-white/40 sm:w-1/3"
          />
          <input
            name="country"
            maxLength={2}
            placeholder="FR"
            className="glass-input rounded-2xl p-3.5 text-center text-sm placeholder:text-white/40 w-20 uppercase"
          />
          <button className="flex items-center justify-center gap-2 rounded-full btn-paradise px-6 py-3 text-xs font-bold hover:scale-105 transition">
            <Plus className="h-4 w-4" />
            <span>Ajouter</span>
          </button>
        </div>
      </form>

      {/* List */}
      <div className="grid gap-3">
        {(churches ?? []).map((c) => (
          <div
            key={c.id}
            className="glass-card glass-card-hover p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{c.name}</span>
                  {c.verified && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-emerald-400/20" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-white/60 mt-0.5">
                  <MapPin className="h-3 w-3 text-teal-400" />
                  <span>{c.city} · {c.country}</span>
                </div>
              </div>
            </div>

            {c.verified && (
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                Vérifiée
              </span>
            )}
          </div>
        ))}
        {(churches ?? []).length === 0 && (
          <div className="glass-card p-10 text-center space-y-2">
            <Building2 className="h-10 w-10 text-amber-400 mx-auto opacity-70" />
            <p className="text-sm font-medium text-white/70">
              Aucune église référencée pour l&apos;instant. Ajoute la tienne. ⛪
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

