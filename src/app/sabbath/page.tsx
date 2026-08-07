import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSabbathActive, sabbathRemainingLabel } from "@/lib/sabbath";
import { startSabbath } from "@/app/actions";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-6xl">🕊️</div>
      <h1 className="text-3xl font-bold text-stone-900">Mode Sabbat</h1>
      {active ? (
        <>
          <p className="text-stone-600">
            Selah est en pause pour toi. Reviens dans{" "}
            <strong className="text-amber-700">
              {sabbathRemainingLabel(profile!.sabbath_until!)}
            </strong>
            .
          </p>
          <p className="rounded-2xl border border-amber-200 bg-white p-5 italic text-stone-700 shadow-sm">
            « Souviens-toi du jour du repos, pour le sanctifier. » — Exode 20:8
          </p>
          <p className="text-sm text-stone-500">
            Profite de ce temps hors ligne avec Dieu. Ta communauté t&apos;attend
            au retour.
          </p>
        </>
      ) : (
        <>
          <p className="text-stone-600">
            Bloque Selah pendant <strong>24 h</strong> pour te consacrer à Dieu
            hors ligne. Aucune notification, aucun fil — repos.
          </p>
          <form action={startSabbath}>
            <button className="rounded-full bg-amber-600 px-8 py-3 font-semibold text-white shadow hover:bg-amber-700">
              Commencer mon Sabbat
            </button>
          </form>
          <Link href="/feed" className="text-sm text-stone-500 underline">
            Retour au fil
          </Link>
        </>
      )}
    </main>
  );
}
