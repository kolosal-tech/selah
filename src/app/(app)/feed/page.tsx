import { supabaseServer } from "@/lib/supabase/server";
import { createPost, toggleAmen, addComment } from "@/app/actions";
import { Sparkles, BookOpen, Send, MessageCircle } from "lucide-react";

const TYPE_LABEL: Record<string, { label: string; bg: string }> = {
  temoignage: { label: "Témoignage", bg: "from-amber-500 to-rose-500" },
  exhortation: { label: "Exhortation", bg: "from-emerald-500 to-teal-600" },
  priere: { label: "Prière", bg: "from-cyan-500 to-blue-600" },
  enseignement: { label: "Enseignement", bg: "from-blue-500 to-indigo-600" },
  louange: { label: "Louange", bg: "from-purple-500 to-pink-600" },
};

export default async function Feed() {
  const supabase = await supabaseServer();
  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles!posts_author_id_fkey(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">Fil d&apos;Édification</h1>
        <p className="mt-1 text-sm text-white/70">
          Découvre les témoignages, exhortations et prières de la communauté.
        </p>
      </div>

      {/* Glassmorphic Post Creation Form */}
      <form
        action={createPost}
        className="glass-card p-5 space-y-4 shadow-2xl relative overflow-hidden"
      >
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Partage ce que Dieu fait dans ta vie…"
          className="glass-input w-full rounded-2xl p-4 text-sm placeholder:text-white/40 resize-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          <select name="type" className="glass-input rounded-xl p-2.5 text-xs text-white bg-slate-900/80">
            {Object.entries(TYPE_LABEL).map(([v, item]) => (
              <option key={v} value={v} className="bg-slate-950 text-white">
                {item.label}
              </option>
            ))}
          </select>
          <input
            name="verse_ref"
            placeholder="Verset (ex. Jean 3:16)"
            className="glass-input flex-1 rounded-xl p-2.5 text-xs placeholder:text-white/40"
          />
          <button className="flex items-center gap-2 rounded-full btn-paradise px-6 py-2.5 text-xs font-bold hover:scale-105 transition">
            <Send className="h-4 w-4" />
            <span>Publier</span>
          </button>
        </div>
      </form>

      {/* Post cards */}
      <div className="space-y-4">
        {(posts ?? []).map((post) => {
          const typeConfig = TYPE_LABEL[post.type] || { label: post.type, bg: "from-emerald-500 to-teal-600" };

          return (
            <article
              key={post.id}
              className="glass-card glass-card-hover p-6 space-y-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-amber-500 to-emerald-400 p-[2px]">
                    <div className="h-full w-full rounded-full bg-slate-900 flex items-center justify-center font-bold text-xs text-amber-300">
                      {(post.profiles?.username || "D")[0].toUpperCase()}
                    </div>
                  </div>
                  <span className="font-bold text-sm text-white">
                    @{post.profiles?.username ?? "disciple"}
                  </span>
                </div>
                <span className={`rounded-full bg-gradient-to-r ${typeConfig.bg} px-3 py-1 text-[11px] font-semibold text-white shadow-sm`}>
                  {typeConfig.label}
                </span>
              </div>

              <p className="text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                {post.body}
              </p>

              {post.verse_ref && (
                <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-xl border border-white/15 px-4 py-2 text-xs italic text-amber-200">
                  <BookOpen className="h-4 w-4 text-amber-400" />
                  <span>📖 {post.verse_ref}</span>
                </div>
              )}

              {/* Actions & Comment section */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/70">
                <form action={toggleAmen.bind(null, post.id)}>
                  <button className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-1.5 font-semibold text-amber-300 transition">
                    <span>🙌 Amen</span>
                    <span className="text-white/60">· {post.amen_count}</span>
                  </button>
                </form>

                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4 text-white/60" />
                  <span>{post.comment_count} commentaires</span>
                </div>
              </div>

              {/* Quick Comment Input */}
              <form action={addComment} className="flex gap-2 pt-1">
                <input type="hidden" name="post_id" value={post.id} />
                <input
                  name="body"
                  placeholder="Encourager ton frère ou ta sœur…"
                  className="glass-input flex-1 rounded-full px-4 py-2 text-xs placeholder:text-white/40"
                />
                <button className="rounded-full bg-white/10 hover:bg-white/20 px-4 text-xs font-bold text-amber-300 border border-white/15">
                  Envoyer
                </button>
              </form>
            </article>
          );
        })}

        {(posts ?? []).length === 0 && (
          <div className="glass-card p-10 text-center space-y-2">
            <Sparkles className="h-10 w-10 text-amber-400 mx-auto opacity-70" />
            <p className="text-sm font-medium text-white/70">
              Le fil est encore calme. Sois le premier à publier et témoigner. 🔥
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

