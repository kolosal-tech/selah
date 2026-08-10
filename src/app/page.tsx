import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSabbathActive } from "@/lib/sabbath";
import { getLocale } from "@/i18n/server";
import { VerticalFeed, type FeedVideo } from "./vertical-feed";

/**
 * Page d'accueil = feed vidéo vertical plein écran, connecté ou non.
 * Les visiteurs regardent librement (vue `videos_feed`, lecture seule) ;
 * créer un compte n'est demandé que pour interagir (amen, publier).
 */
export default async function Accueil({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v: videoPartagee } = await searchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let me: { id: string; username: string | null } | null = null;
  let amened: string[] = [];
  let prie: string[] = [];
  let suivis: string[] = [];
  if (user) {
    const [{ data: profile }, { data: amens }, { data: prayers }, { data: follows }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("username, sabbath_until")
          .eq("id", user.id)
          .single(),
        supabase.from("video_amens").select("video_id").eq("user_id", user.id),
        supabase.from("video_prayers").select("video_id").eq("user_id", user.id),
        supabase.from("follows").select("followed_id").eq("follower_id", user.id),
      ]);
    // Le Mode Sabbat vaut aussi pour le feed : la promesse de déconnexion
    // n'aurait aucun sens si la page la plus addictive restait ouverte.
    if (isSabbathActive(profile?.sabbath_until)) redirect("/sabbath");
    me = { id: user.id, username: profile?.username ?? null };
    amened = (amens ?? []).map((a) => a.video_id);
    prie = (prayers ?? []).map((p) => p.video_id);
    suivis = (follows ?? []).map((f) => f.followed_id);
  }

  // Classement « édifiant » : la vue calcule score (engagement pondéré,
  // amorti par l'âge) et rang_auteur (diversité — pas d'empilement d'un
  // même auteur en tête). Tri (rang_auteur, score desc) = feed intercalé.
  const { data: videos, error } = await supabase
    .from("videos_feed")
    .select("*")
    .order("rang_auteur", { ascending: true })
    .order("score", { ascending: false })
    .order("id", { ascending: true })
    .limit(24);

  let liste = (videos ?? []) as FeedVideo[];

  // Lien de partage /?v=<id> : la vidéo visée passe en tête du feed.
  if (videoPartagee && /^[0-9a-f-]{36}$/i.test(videoPartagee)) {
    const dejaLa = liste.find((x) => x.id === videoPartagee);
    if (dejaLa) {
      liste = [dejaLa, ...liste.filter((x) => x.id !== videoPartagee)];
    } else {
      const { data: cible } = await supabase
        .from("videos_feed")
        .select("*")
        .eq("id", videoPartagee)
        .maybeSingle();
      if (cible) liste = [cible as FeedVideo, ...liste];
    }
  }

  // Légende et référence de verset dans la langue de l'utilisateur, quand la
  // traduction existe (les vidéos d'origine sont en français).
  const locale = await getLocale();
  if (locale !== "fr" && liste.length > 0) {
    const { data: traductions } = await supabase
      .from("video_translations")
      .select("video_id, caption, verse_ref, storage_path, thumb_path")
      .eq("lang", locale)
      .in("video_id", liste.map((v) => v.id));
    const parId = new Map((traductions ?? []).map((t) => [t.video_id, t]));
    liste = liste.map((v) => {
      const t = parId.get(v.id);
      return t
        ? {
            ...v,
            caption: t.caption ?? v.caption,
            verse_ref: t.verse_ref ?? v.verse_ref,
            storage_path: t.storage_path ?? v.storage_path,
            thumb_path: t.thumb_path ?? v.thumb_path,
          }
        : v;
    });
  }

  const paths = [
    ...new Set(liste.flatMap((video) => [video.storage_path, video.thumb_path].filter(Boolean))),
  ] as string[];
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("videos").createSignedUrls(paths, 60);
    const urls = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
    liste = liste.map((video) => ({
      ...video,
      media_url: urls.get(video.storage_path) ?? null,
      thumb_url: video.thumb_path ? (urls.get(video.thumb_path) ?? null) : null,
    }));
  }

  return (
    <VerticalFeed
      initialVideos={liste}
      me={me}
      initialAmened={amened}
      initialPrie={prie}
      initialSuivis={suivis}
      erreurInitiale={Boolean(error)}
    />
  );
}
