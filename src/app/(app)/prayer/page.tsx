import { supabaseServer } from "@/lib/supabase/server";
import { createPrayerRequest, prayNow } from "@/app/actions";

export default async function Prayer() {
  const supabase = await supabaseServer();
  const { data: requests } = await supabase
    .from("prayer_requests")
    .select("*, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-stone-900">Mur de prière</h1>
      <form
        action={createPrayerRequest}
        className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
      >
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Dépose ton sujet de prière…"
          className="resize-none rounded-lg border border-stone-200 p-3"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" name="anonymous" /> Anonyme
          </label>
          <button className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Déposer
          </button>
        </div>
      </form>

      {(requests ?? []).map((r) => (
        <article
          key={r.id}
          className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-stone-900">
              {r.anonymous ? "Anonyme" : `@${r.profiles?.username ?? "inconnu"}`}
            </span>
            {r.answered && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Exaucé ✨
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-stone-800">{r.body}</p>
          <div className="mt-3 flex items-center gap-3">
            <form action={prayNow.bind(null, r.id)}>
              <button className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-200">
                🙏 Je prie pour toi maintenant
              </button>
            </form>
            <span className="text-sm text-stone-500">
              {r.pray_count} {r.pray_count > 1 ? "intercesseurs" : "intercesseur"}
            </span>
          </div>
        </article>
      ))}
      {(requests ?? []).length === 0 && (
        <p className="text-center text-stone-400">
          Aucune requête pour l&apos;instant. Dépose la première. 🙏
        </p>
      )}
    </main>
  );
}
