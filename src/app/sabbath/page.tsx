import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSabbathActive, sabbathRemainingLabel } from "@/lib/sabbath";
import { startSabbath } from "@/app/actions";
import { AmbianceSonore } from "@/app/ambiance-sonore";
import { getMessages } from "@/i18n/server";

export default async function Sabbath() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("sabbath_until")
    .eq("id", user.id)
    .single();

  const active = isSabbathActive(profile?.sabbath_until);
  const m = await getMessages();

  return (
    <main className="animate-arrive mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-6xl drop-shadow-[0_0_30px_rgba(148,163,184,0.5)]">🕊️</div>
      <h1 className="text-3xl font-bold text-gradient-gold">{m.sabbat.titre}</h1>
      {active ? (
        <>
          <p className="text-white/75">
            {m.sabbat.enPause}{" "}
            <strong className="text-amber-300">
              {sabbathRemainingLabel(profile!.sabbath_until!)}
            </strong>
            .
          </p>
          <p className="glass-card p-5 italic text-white/85">
            {m.sabbat.verset}
          </p>
          <p className="text-sm text-white/70">
            {m.sabbat.profite}
          </p>
        </>
      ) : (
        <>
          <p className="text-white/75">{m.sabbat.invitation}</p>
          <form action={startSabbath}>
            <button className="btn-paradise rounded-full px-8 py-3 transition hover:scale-105">
              {m.sabbat.commencer}
            </button>
          </form>
          <Link href="/feed" className="text-sm text-white/50 underline hover:text-white/80">
            {m.sabbat.retourFil}
          </Link>
        </>
      )}

      {/* Le repos n'est pas le silence forcé : la nappe d'ambiance reste
          disponible pendant le Sabbat, à l'initiative de l'utilisateur. */}
      <div className="mt-2 flex items-center gap-3 text-xs text-white/45">
        <AmbianceSonore />
        <span>{m.sabbat.nappe}</span>
      </div>
    </main>
  );
}
