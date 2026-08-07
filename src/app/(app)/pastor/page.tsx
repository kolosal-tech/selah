import { supabaseServer } from "@/lib/supabase/server";
import { joinChurch } from "@/app/actions";
import { Users, Flame, MessageSquare, HeartHandshake, Building2, TrendingUp } from "lucide-react";

export default async function Pastor() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: moi } = await supabase
    .from("profiles")
    .select("church_id, role")
    .eq("id", user!.id)
    .single();

  const { data: churches } = await supabase
    .from("churches")
    .select("id, name, city, country")
    .order("name")
    .limit(200);

  if (!moi?.church_id) {
    return (
      <main className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">Dashboard pasteur</h1>
          <p className="mt-1 text-sm text-white/70">
            Rattache-toi à ton église locale pour suivre la vitalité de ta communauté.
          </p>
        </div>
        <form
          action={joinChurch}
          className="glass-card p-6 flex flex-col sm:flex-row gap-3 shadow-2xl"
        >
          <select
            name="church_id"
            required
            className="glass-input flex-1 rounded-2xl p-3.5 text-sm text-white bg-slate-900/80"
          >
            <option value="" className="bg-slate-950 text-white/60">Choisis ton église…</option>
            {(churches ?? []).map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-950 text-white">
                {c.name} — {c.city || c.country}
              </option>
            ))}
          </select>
          <button className="rounded-full btn-paradise px-8 py-3 text-xs font-bold hover:scale-105 transition">
            Rejoindre
          </button>
        </form>
      </main>
    );
  }

  const [{ data: pouls }, { data: eglise }] = await Promise.all([
    supabase.from("church_pulse").select("*").eq("church_id", moi.church_id).maybeSingle(),
    supabase.from("churches").select("name, city, country").eq("id", moi.church_id).single(),
  ]);

  const cartes = [
    { label: "Membres sur Selah", valeur: pouls?.membres ?? 0, icon: Users, gradient: "from-amber-400 to-rose-400" },
    { label: "Jours de fidélité cumulés", valeur: pouls?.jours_de_fidelite ?? 0, icon: Flame, gradient: "from-amber-400 to-emerald-400" },
    { label: "Publications (7 jours)", valeur: pouls?.posts_7j ?? 0, icon: MessageSquare, gradient: "from-teal-400 to-cyan-400" },
    { label: "Prières portées (7 jours)", valeur: pouls?.prieres_7j ?? 0, icon: HeartHandshake, gradient: "from-cyan-400 to-indigo-400" },
  ];

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-amber-400" />
          <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">{eglise?.name}</h1>
        </div>
        <p className="mt-1 text-sm text-white/70">
          {eglise?.city || eglise?.country} · Aperçu consolidé de l&apos;activité spirituelle
        </p>
      </div>

      {/* Large Statistics Widgets featuring Gold/Turquoise Text Gradients & Glowing Bar Charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        {cartes.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="glass-card glass-card-hover p-6 relative overflow-hidden flex flex-col justify-between"
            >
              {/* Background ambient glow */}
              <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/60 tracking-wide uppercase">
                  {item.label}
                </span>
                <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-amber-300 border border-white/10">
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-4">
                <div className={`text-4xl font-extrabold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                  {item.valeur}
                </div>
              </div>

              {/* Glowing activity bar */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <div className="h-1.5 flex-1 rounded-full bg-black/40 overflow-hidden p-0.5 border border-white/5">
                  <div className={`h-full rounded-full bg-gradient-to-r ${item.gradient} shadow-[0_0_8px_rgba(245,158,11,0.5)]`} style={{ width: "65%" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

