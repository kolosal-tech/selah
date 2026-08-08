import { supabaseServer } from "@/lib/supabase/server";
import { createPost, toggleAmen, addComment } from "@/app/actions";
import { Sparkles, BookOpen, Send, MessageCircle } from "lucide-react";
import { getMessages } from "@/i18n/server";

const TYPE_BG: Record<string, string> = {
  temoignage: "from-amber-500 to-rose-500",
  exhortation: "from-emerald-500 to-teal-600",
  priere: "from-cyan-500 to-blue-600",
  enseignement: "from-blue-500 to-indigo-600",
  louange: "from-purple-500 to-pink-600",
};

export default async function Feed() {
  const supabase = await supabaseServer();
  const m = await getMessages();
  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles!posts_author_id_fkey(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const typeLabel = (t: string) => m.types[t as keyof typeof m.types] ?? t;

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">{m.feed.titre}</h1>
        <p className="mt-1 text-sm text-white/70">{m.feed.sousTitre}</p>
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
          placeholder={m.feed.placeholder}
          className="glass-input w-full rounded-2xl p-4 text-sm placeholder:text-white/40 resize-none"
        />
        <div className="flex flex-wrap items-center gap-3">
          <select name="type" className="glass-input rounded-xl p-2.5 text-xs text-white bg-slate-900/80">
            {Object.keys(TYPE_BG).map((v) => (
              <option key={v} value={v} className="bg-slate-950 text-white">
                {typeLabel(v)}
              </option>
            ))}
          </select>
          <input
            name="verse_ref"
            placeholder={m.feed.versetPlaceholder}
            className="glass-input flex-1 rounded-xl p-2.5 text-xs placeholder:text-white/40"
          />
          <button className="flex items-center gap-2 rounded-full btn-paradise px-6 py-2.5 text-xs font-bold hover:scale-105 transition">
            <Send className="h-4 w-4" />
            <span>{m.commun.publier}</span>
          </button>
        </div>
      </form>

      {/* Post cards */}
      <div className="space-y-4">
        {(posts ?? []).map((post) => {
          const bg = TYPE_BG[post.type] || "from-emerald-500 to-teal-600";

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
                    @{post.profiles?.username ?? m.commun.disciple}
                  </span>
                </div>
                <span className={`rounded-full bg-gradient-to-r ${bg} px-3 py-1 text-[11px] font-semibold text-white shadow-sm`}>
                  {typeLabel(post.type)}
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
                    <span>{m.feed.amen}</span>
                    <span className="text-white/60">· {post.amen_count}</span>
                  </button>
                </form>

                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4 text-white/60" />
                  <span>{m.feed.commentaires(post.comment_count)}</span>
                </div>
              </div>

              {/* Quick Comment Input */}
              <form action={addComment} className="flex gap-2 pt-1">
                <input type="hidden" name="post_id" value={post.id} />
                <input
                  name="body"
                  placeholder={m.feed.encourager}
                  className="glass-input flex-1 rounded-full px-4 py-2 text-xs placeholder:text-white/40"
                />
                <button className="rounded-full bg-white/10 hover:bg-white/20 px-4 text-xs font-bold text-amber-300 border border-white/15">
                  {m.commun.envoyer}
                </button>
              </form>
            </article>
          );
        })}

        {(posts ?? []).length === 0 && (
          <div className="glass-card p-10 text-center space-y-2">
            <Sparkles className="h-10 w-10 text-amber-400 mx-auto opacity-70" />
            <p className="text-sm font-medium text-white/70">{m.feed.vide}</p>
          </div>
        )}
      </div>
    </main>
  );
}
