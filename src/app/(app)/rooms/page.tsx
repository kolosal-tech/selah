import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { openPrayerRoom } from "@/app/actions";

export default async function Rooms() {
  const supabase = await supabaseServer();
  const { data: rooms } = await supabase
    .from("prayer_rooms")
    .select("*, profiles!prayer_rooms_host_id_fkey(username)")
    .is("closed_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Upper Room</h1>
        <p className="text-stone-600">
          Des salles de prière ouvertes en continu. On entre, on prie ensemble,
          on écrit ce que l&apos;Esprit met sur le cœur. (Actes 1:13-14)
        </p>
      </div>

      <form
        action={openPrayerRoom}
        className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:flex-row"
      >
        <input
          name="title"
          required
          minLength={3}
          placeholder="Titre de la salle (ex. Veillée pour le Sahel)"
          className="flex-1 rounded-lg border border-stone-200 p-2 text-sm"
        />
        <input
          name="topic"
          placeholder="Sujet"
          className="rounded-lg border border-stone-200 p-2 text-sm"
        />
        <button className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          Ouvrir
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {(rooms ?? []).map((r) => (
          <Link
            key={r.id}
            href={`/rooms/${r.id}`}
            className="rounded-xl border border-amber-100 bg-white p-4 hover:border-amber-300"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-900">{r.title}</span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                ● en direct
              </span>
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {r.topic || "Prière libre"} · animée par @{r.profiles?.username}
            </p>
          </Link>
        ))}
        {(rooms ?? []).length === 0 && (
          <p className="text-center text-stone-400">
            Aucune salle ouverte. Ouvre la première et appelle tes frères. 🕯️
          </p>
        )}
      </div>
    </main>
  );
}
