import { supabaseServer } from "@/lib/supabase/server";
import { offerMentorship, requestMentorship } from "@/app/actions";

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
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Paul &amp; Timothée</h1>
        <p className="text-stone-600">
          Mentorat volontaire : des aînés dans la foi accompagnent les plus
          jeunes, un à un. (2 Tim. 2:2)
        </p>
      </div>

      <form
        action={offerMentorship}
        className="flex gap-2 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
      >
        <input
          name="topics"
          placeholder="Je me rends disponible comme mentor (thèmes : prière, Parole…)"
          className="flex-1 rounded-lg border border-stone-200 p-2 text-sm"
        />
        <button className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
          Devenir Paul
        </button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-stone-900">Mentors disponibles</h2>
        {(offers ?? []).map((o) => (
          <div
            key={o.user_id}
            className="flex items-center justify-between rounded-xl border border-amber-100 bg-white p-3"
          >
            <div>
              <span className="font-semibold">@{o.profiles?.username}</span>
              <span className="ml-2 text-sm text-stone-500">{o.topics}</span>
            </div>
            {o.user_id !== user?.id && (
              <form action={requestMentorship.bind(null, o.user_id)}>
                <button className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 hover:bg-amber-200">
                  Demander
                </button>
              </form>
            )}
          </div>
        ))}
        {(offers ?? []).length === 0 && (
          <p className="text-stone-400">Aucun mentor disponible pour l&apos;instant.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-stone-900">Mes mentorats</h2>
        {(mine ?? []).map((m) => (
          <div key={m.id} className="rounded-xl border border-amber-100 bg-white p-3 text-sm">
            @{m.mentor?.username} → @{m.mentee?.username} ·{" "}
            <span className="text-amber-700">{m.status}</span>
          </div>
        ))}
        {(mine ?? []).length === 0 && (
          <p className="text-stone-400">Aucun mentorat en cours.</p>
        )}
      </section>
    </main>
  );
}
