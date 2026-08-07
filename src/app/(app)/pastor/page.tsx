import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { joinChurch } from "@/app/actions";

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
          <h1 className="text-2xl font-bold text-stone-900">Dashboard pasteur</h1>
          <p className="text-stone-600">
            Rattache-toi d&apos;abord à une église pour voir le pouls de ta
            communauté. Elle n&apos;y est pas ?{" "}
            <Link href="/churches" className="font-semibold text-amber-700">
              Ajoute-la à l&apos;annuaire
            </Link>
            .
          </p>
        </div>
        <form
          action={joinChurch}
          className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:flex-row"
        >
          <select
            name="church_id"
            required
            className="flex-1 rounded-lg border border-stone-200 p-2 text-sm"
          >
            <option value="">Choisis ton église…</option>
            {(churches ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.city || c.country}
              </option>
            ))}
          </select>
          <button className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700">
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
    ["Membres sur Selah", pouls?.membres ?? 0, "👥"],
    ["Jours de fidélité cumulés", pouls?.jours_de_fidelite ?? 0, "🔥"],
    ["Publications (7 jours)", pouls?.posts_7j ?? 0, "💬"],
    ["Prières portées (7 jours)", pouls?.prieres_7j ?? 0, "🙏"],
  ] as const;

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Dashboard pasteur</h1>
        <p className="text-stone-600">
          {eglise?.name} · {eglise?.city || eglise?.country}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          Chiffres agrégés uniquement. Aucun contenu individuel n&apos;est
          exposé : le pasteur voit le pouls, jamais le journal intime.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cartes.map(([label, valeur, icone]) => (
          <div
            key={label}
            className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm"
          >
            <div className="text-2xl">{icone}</div>
            <div className="mt-1 text-3xl font-bold text-amber-700">{valeur}</div>
            <div className="text-sm text-stone-600">{label}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
