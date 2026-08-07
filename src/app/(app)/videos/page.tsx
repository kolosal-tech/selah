import { supabaseServer } from "@/lib/supabase/server";
import { toggleVideoAmen } from "@/app/actions";
import { UploadForm } from "./upload-form";

const TYPE_LABEL: Record<string, string> = {
  temoignage: "🔥 Témoignage",
  exhortation: "💬 Exhortation",
  priere: "🙏 Prière",
  enseignement: "📖 Enseignement",
  louange: "🎵 Louange",
};

export default async function Videos() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: videos } = await supabase
    .from("videos")
    .select("*, profiles!videos_author_id_fkey(username)")
    .order("created_at", { ascending: false })
    .limit(30);

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/`;

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Témoignages en vidéo</h1>
        <p className="text-stone-600">
          Une minute pour raconter ce que Dieu a fait. Vertical, court, vrai.
        </p>
      </div>

      {user && <UploadForm userId={user.id} />}

      <div className="flex snap-y snap-mandatory flex-col gap-4">
        {(videos ?? []).map((v) => (
          <article
            key={v.id}
            className="snap-start overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm"
          >
            <video
              src={base + v.storage_path}
              controls
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-full bg-black object-contain"
            />
            <div className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-stone-900">
                  @{v.profiles?.username ?? "inconnu"}
                </span>
                <span className="text-amber-700">{TYPE_LABEL[v.type]}</span>
              </div>
              {v.caption && (
                <p className="mt-2 whitespace-pre-wrap text-stone-800">{v.caption}</p>
              )}
              {v.verse_ref && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm italic text-amber-800">
                  📖 {v.verse_ref}
                </p>
              )}
              <form action={toggleVideoAmen.bind(null, v.id)} className="mt-3">
                <button className="rounded-full px-3 py-1 text-sm text-stone-500 hover:bg-amber-100">
                  🙌 Amen · {v.amen_count}
                </button>
              </form>
            </div>
          </article>
        ))}
        {(videos ?? []).length === 0 && (
          <p className="text-center text-stone-400">
            Aucune vidéo encore. Sois le premier à témoigner en face caméra. 🎥
          </p>
        )}
      </div>
    </main>
  );
}
