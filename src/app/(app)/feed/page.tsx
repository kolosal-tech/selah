import { supabaseServer } from "@/lib/supabase/server";
import { createPost, toggleAmen, addComment } from "@/app/actions";

const TYPE_LABEL: Record<string, string> = {
  temoignage: "🔥 Témoignage",
  exhortation: "💬 Exhortation",
  priere: "🙏 Prière",
  enseignement: "📖 Enseignement",
  louange: "🎵 Louange",
};

export default async function Feed() {
  const supabase = await supabaseServer();
  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="flex flex-col gap-6">
      <form
        action={createPost}
        className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
      >
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Partage un témoignage, une exhortation, une prière…"
          className="resize-none rounded-lg border border-stone-200 p-3"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select name="type" className="rounded-lg border border-stone-200 p-2 text-sm">
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input
            name="verse_ref"
            placeholder="Verset (ex. Jean 3:16)"
            className="flex-1 rounded-lg border border-stone-200 p-2 text-sm"
          />
          <button className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Publier
          </button>
        </div>
      </form>

      {(posts ?? []).map((post) => (
        <article
          key={post.id}
          className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-stone-900">
              @{post.profiles?.username ?? "inconnu"}
            </span>
            <span className="text-amber-700">{TYPE_LABEL[post.type]}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-stone-800">{post.body}</p>
          {post.verse_ref && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm italic text-amber-800">
              📖 {post.verse_ref}
            </p>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm text-stone-500">
            <form action={toggleAmen.bind(null, post.id)}>
              <button className="rounded-full px-3 py-1 hover:bg-amber-100">
                🙌 Amen · {post.amen_count}
              </button>
            </form>
            <span>💬 {post.comment_count}</span>
          </div>
          <form action={addComment} className="mt-2 flex gap-2">
            <input type="hidden" name="post_id" value={post.id} />
            <input
              name="body"
              placeholder="Encourager…"
              className="flex-1 rounded-lg border border-stone-200 p-2 text-sm"
            />
            <button className="text-sm font-semibold text-amber-700">Envoyer</button>
          </form>
        </article>
      ))}
      {(posts ?? []).length === 0 && (
        <p className="text-center text-stone-400">
          Le fil est encore vide. Sois le premier à témoigner. 🔥
        </p>
      )}
    </main>
  );
}
