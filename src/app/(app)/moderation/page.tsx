import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { BoutonsModeration } from "./boutons";
import { ShieldCheck, Flag, EyeOff } from "lucide-react";
import { getLocale, getMessages } from "@/i18n/server";
import { pseudo } from "@/i18n/config";

type LigneSignalement = {
  id: string;
  reason: string;
  created_at: string;
  reporter: { username: string } | null;
  video: {
    id: string;
    storage_path: string;
    thumb_path: string | null;
    caption: string | null;
    verse_ref: string | null;
    type: string;
    hidden: boolean;
    profiles: { username: string } | null;
  } | null;
};

/** File de modération des vidéos. Réservée aux modérateurs et admins ;
 *  la RLS côté base fait autorité, la redirection évite juste une page vide. */
export default async function Moderation() {
  const supabase = await supabaseServer();
  const m = await getMessages();
  const locale = await getLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  if (!profile || !["moderateur", "admin"].includes(profile.role)) {
    redirect("/feed");
  }

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/`;

  const [{ data: signalements }, { data: masquees }] = await Promise.all([
    supabase
      .from("reports")
      .select(
        `id, reason, created_at,
         reporter:profiles!reports_reporter_id_fkey(username),
         video:videos!reports_video_id_fkey(
           id, storage_path, thumb_path, caption, verse_ref, type, hidden,
           profiles!videos_author_id_fkey(username)
         )`,
      )
      .not("video_id", "is", null)
      .eq("status", "ouvert")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("videos")
      .select(
        "id, storage_path, thumb_path, caption, type, hidden, profiles!videos_author_id_fkey(username)",
      )
      .eq("hidden", true)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const lignes = (signalements ?? []) as unknown as LigneSignalement[];
  const videosMasquees = (masquees ?? []) as unknown as NonNullable<
    LigneSignalement["video"]
  >[];

  return (
    <main className="flex flex-col gap-8 pb-10">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
          <ShieldCheck className="h-4 w-4" />
          <span>{m.moderation.badge}</span>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          {m.moderation.titre}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {m.moderation.sousTitre}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Flag className="h-5 w-5 text-rose-400" />
          <span>{m.moderation.ouverts}</span>
          <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-300">
            {lignes.length}
          </span>
        </h2>

        {lignes.length === 0 && (
          <div className="glass-card flex flex-col items-center gap-2 p-8 text-center">
            <span className="text-3xl">🕊️</span>
            <p className="text-sm text-white/70">
              {m.moderation.paix}
            </p>
          </div>
        )}

        {lignes.map(
          (s) =>
            s.video && (
              <article key={s.id} className="glass-card flex gap-4 p-4">
                <video
                  src={base + s.video.storage_path}
                  poster={s.video.thumb_path ? base + s.video.thumb_path : undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-[9/16] w-28 shrink-0 rounded-xl bg-black object-cover sm:w-36"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                    <span className="font-bold text-white/90">
                      @{s.video.profiles?.username ?? m.commun.inconnu}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5">
                      {s.video.type}
                    </span>
                    {s.video.hidden && (
                      <span className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-300">
                        <EyeOff className="h-3 w-3" /> {m.moderation.masquee}
                      </span>
                    )}
                  </div>
                  {s.video.caption && (
                    <p className="line-clamp-2 text-sm text-white/85">
                      {s.video.caption}
                    </p>
                  )}
                  <p className="text-xs text-white/50">
                    {m.moderation.signaleePar(pseudo(s.reporter?.username ?? m.commun.inconnu))} —{" "}
                    {new Date(s.created_at).toLocaleDateString(locale, {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <br />
                    {m.moderation.motif(s.reason)}
                  </p>
                  <div className="mt-auto pt-2">
                    <BoutonsModeration
                      videoId={s.video.id}
                      reportId={s.id}
                      hidden={s.video.hidden}
                    />
                  </div>
                </div>
              </article>
            ),
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <EyeOff className="h-5 w-5 text-white/60" />
          <span>{m.moderation.masquees}</span>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/70">
            {videosMasquees.length}
          </span>
        </h2>

        {videosMasquees.length === 0 && (
          <p className="text-sm text-white/50">
            {m.moderation.aucuneMasquee}
          </p>
        )}

        {videosMasquees.map((v) => (
          <article key={v.id} className="glass-card flex items-center gap-4 p-4">
            <video
              src={base + v.storage_path}
              poster={v.thumb_path ? base + v.thumb_path : undefined}
              controls
              playsInline
              preload="metadata"
              className="aspect-[9/16] w-20 shrink-0 rounded-xl bg-black object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white/90">
                @{v.profiles?.username ?? m.commun.inconnu}
              </p>
              {v.caption && (
                <p className="line-clamp-2 text-sm text-white/70">{v.caption}</p>
              )}
              <div className="mt-2">
                <BoutonsModeration videoId={v.id} hidden={v.hidden} />
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
