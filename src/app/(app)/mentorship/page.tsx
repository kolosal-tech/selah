import { supabaseServer } from "@/lib/supabase/server";
import { offerMentorship, requestMentorship } from "@/app/actions";
import { Users, UserPlus } from "lucide-react";

export default async function Mentorship() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: offers }, { data: mine }] = await Promise.all([
    supabase.from("mentor_offers").select("*, profiles(username, role)").limit(50),
    supabase
      .from("mentorships")
      .select("*, mentor:profiles!mentorships_mentor_id_fkey(username), mentee:profiles!mentorships_mentee_id_fkey(username)")
      .limit(20),
  ]);

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">Paul &amp; Timothée</h1>
        <p className="mt-1 text-sm text-white/70">
          Mentorat volontaire : transmission de la foi, écoute et discipulat (2 Tim. 2:2)
        </p>
      </div>

      {/* Form to offer mentorship */}
      <form
        action={offerMentorship}
        className="glass-card p-5 flex flex-col sm:flex-row gap-3 shadow-2xl relative overflow-hidden"
      >
        <input
          name="topics"
          placeholder="Je me rends disponible comme mentor (ex. prière, vocation…)"
          className="glass-input flex-1 rounded-2xl p-3.5 text-sm placeholder:text-white/40"
        />
        <button className="flex items-center justify-center gap-2 rounded-full btn-paradise px-6 py-3 text-xs font-bold hover:scale-105 transition">
          <UserPlus className="h-4 w-4" />
          <span>Devenir Paul</span>
        </button>
      </form>

      {/* Mentors available list */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white/90 flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-400" />
          <span>Mentors disponibles</span>
        </h2>

        <div className="grid gap-3">
          {(offers ?? []).map((o) => (
            <div
              key={o.user_id}
              className="glass-card glass-card-hover p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-amber-500 to-emerald-400 p-[2px]">
                  <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center font-bold text-amber-300 text-xs">
                    {(o.profiles?.username || "M")[0].toUpperCase()}
                  </div>
                </div>
                <div>
                  <span className="font-bold text-sm text-white">@{o.profiles?.username}</span>
                  <span className="ml-2 rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[10px] font-semibold border border-emerald-500/30">
                    Disponible
                  </span>
                  <p className="mt-0.5 text-xs text-white/60">{o.topics || "Accompagnement spirituel"}</p>
                </div>
              </div>

              {o.user_id !== user?.id && (
                <form action={requestMentorship.bind(null, o.user_id)}>
                  <button className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 text-xs font-bold text-white transition">
                    Demander
                  </button>
                </form>
              )}
            </div>
          ))}
          {(offers ?? []).length === 0 && (
            <div className="glass-card p-6 text-center text-xs text-white/50">
              Aucun mentor disponible pour l&apos;instant. Propose le premier accompagnement.
            </div>
          )}
        </div>
      </section>

      {/* Mes mentorats */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white/90">Mes mentorats</h2>
        <div className="grid gap-3">
          {(mine ?? []).map((m) => (
            <div key={m.id} className="glass-card p-4 flex items-center justify-between text-xs">
              <span className="text-white/80">
                <strong className="text-amber-300">@{m.mentor?.username}</strong> →{" "}
                <strong className="text-teal-300">@{m.mentee?.username}</strong>
              </span>
              <span className="rounded-full bg-amber-500/20 text-amber-300 px-3 py-1 font-semibold border border-amber-500/30">
                {m.status}
              </span>
            </div>
          ))}
          {(mine ?? []).length === 0 && (
            <div className="glass-card p-6 text-center text-xs text-white/50">
              Aucun mentorat en cours.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

