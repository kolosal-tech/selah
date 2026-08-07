import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { UploadForm } from "./upload-form";
import { Clapperboard, Play } from "lucide-react";

/** Le feed vidéo vit en plein écran sur la page d'accueil `/`.
 *  Ici : le studio de publication, et la liste de ses propres vidéos. */
export default async function PublierVideo() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: miennes } = await supabase
    .from("videos")
    .select("id, caption, type, amen_count, pray_count, comment_count, hidden, created_at")
    .eq("author_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="flex flex-col gap-8 pb-10">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
          <Clapperboard className="h-4 w-4" />
          <span>Studio</span>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Publier une vidéo
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Une minute pour raconter ce que Dieu a fait. Vertical, court, vrai.
        </p>
        <Link
          href="/"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300 hover:text-amber-200"
        >
          <Play className="h-3.5 w-3.5 fill-amber-300" />
          <span>Voir le feed</span>
        </Link>
      </div>

      <UploadForm userId={user!.id} />

      {(miennes ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-white">Mes vidéos</h2>
          <ul className="flex flex-col gap-2">
            {(miennes ?? []).map((v) => (
              <li key={v.id} className="glass-card flex items-center justify-between px-4 py-3 text-sm">
                <span className="min-w-0 truncate text-white/85">
                  {v.caption || "(sans légende)"}
                  {v.hidden && (
                    <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      masquée
                    </span>
                  )}
                </span>
                <span className="ml-3 flex shrink-0 items-center gap-3 text-white/60">
                  <span>❤️ {v.amen_count}</span>
                  <span>🙏 {v.pray_count}</span>
                  <span>💬 {v.comment_count}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
