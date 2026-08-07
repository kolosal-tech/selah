import { supabaseServer } from "@/lib/supabase/server";
import { addChurch } from "@/app/actions";

export default async function Churches() {
  const supabase = await supabaseServer();
  const { data: churches } = await supabase
    .from("churches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Annuaire des églises</h1>
        <p className="text-stone-600">
          Référence ton église. La vérification (badge ✅) est faite par les
          modérateurs.
        </p>
      </div>
      <form
        action={addChurch}
        className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:flex-row"
      >
        <input
          name="name"
          required
          placeholder="Nom de l'église"
          className="flex-1 rounded-lg border border-stone-200 p-2 text-sm"
        />
        <input
          name="city"
          placeholder="Ville"
          className="rounded-lg border border-stone-200 p-2 text-sm"
        />
        <input
          name="country"
          maxLength={2}
          placeholder="Pays (FR)"
          className="w-24 rounded-lg border border-stone-200 p-2 text-sm uppercase"
        />
        <button className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          Ajouter
        </button>
      </form>
      <div className="flex flex-col gap-2">
        {(churches ?? []).map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-amber-100 bg-white p-3"
          >
            <span className="font-semibold text-stone-900">
              {c.name} {c.verified && "✅"}
            </span>
            <span className="text-sm text-stone-500">
              {c.city} · {c.country}
            </span>
          </div>
        ))}
        {(churches ?? []).length === 0 && (
          <p className="text-center text-stone-400">
            Aucune église référencée. Ajoute la tienne. ⛪
          </p>
        )}
      </div>
    </main>
  );
}
