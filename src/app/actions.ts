"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { sabbathEnd } from "@/lib/sabbath";
import { COOKIE_LOCALE, estLocale, localePourPays } from "@/i18n/config";
import {
  identifiantDepuisNom,
  identifiantNeutre,
  nettoyerNomAffiche,
  nomAfficheValide,
} from "@/lib/identifiant";
import { isEnabled } from "@/lib/flags";
import { recordProductEventAfter } from "@/lib/analytics/record";

// Après authentification, le fil vidéo (route `/`) est l'entrée par défaut.
const POST_AUTH_REDIRECT = "/";

async function requireUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Entonnoir unique des actions authentifiées : une seule visite par jour est
  // conservée, l'index unique en base absorbe la répétition.
  recordProductEventAfter(supabase, { name: "session_start", surface: "session" });
  return { supabase, user };
}

type RateLimitScope =
  | "post"
  | "comment"
  | "prayer_request"
  | "prayer_action"
  | "report"
  | "video_publish"
  | "video_amen"
  | "video_comment"
  | "video_prayer"
  | "follow"
  | "room_create"
  | "challenge_create";

async function rateLimit(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  scope: RateLimitScope,
) {
  const { data, error } = await supabase.rpc("consume_rate_limit", { p_scope: scope });
  const accepte = !error && data === true;
  // Un seul point de mesure couvre les douze portées : un refus de quota est le
  // signal d'abandon le plus exploitable dont dispose le produit aujourd'hui.
  if (!accepte) {
    recordProductEventAfter(supabase, {
      name: "action_refused",
      surface: scope,
      outcome: "refused",
      reason: "rate_limited",
    });
  }
  return accepte;
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nom = nettoyerNomAffiche(String(formData.get("nom") ?? ""));
  const country = String(formData.get("country") ?? "FR").toUpperCase().slice(0, 2);
  if (!formData.get("charte")) {
    redirect("/signup?error=charte");
  }
  if (!nomAfficheValide(nom)) {
    redirect("/signup?error=nom");
  }
  // Un prénom suffit : l'identifiant technique en est dérivé, et le trigger
  // `handle_new_user` règle les collisions en suffixant. Une écriture non
  // latine ne laissant rien en ASCII, on retombe sur un identifiant neutre.
  const username = identifiantDepuisNom(nom) || identifiantNeutre(email);
  // La langue suit le pays choisi, dès maintenant : l'écran suivant
  // (confirmation ou accueil) parle déjà la langue de l'utilisateur.
  const locale = localePourPays(country);
  const jar = await cookies();
  jar.set(COOKIE_LOCALE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: nom, country, locale } },
  });
  if (error || !data.user)
    redirect(`/signup?error=${encodeURIComponent(error?.message ?? "inconnu")}`);
  // Le profil est créé par le trigger handle_new_user (avec ou sans confirmation email).
  if (!data.session) redirect("/login?info=confirm");
  // `redirect()` lève NEXT_REDIRECT : toute mesure placée après serait perdue.
  recordProductEventAfter(supabase, { name: "signup_completed", surface: "auth" });
  redirect(POST_AUTH_REDIRECT);
}

/** Changement de langue : cookie tout de suite, profil si connecté. */
export async function setLocale(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  if (!estLocale(locale)) return;
  const jar = await cookies();
  jar.set(COOKIE_LOCALE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ lang: locale }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
}

/** Enregistre uniquement un chemin d'avatar appartenant à la session courante. */
export async function setProfileAvatar(path: string) {
  const { supabase, user } = await requireUser();
  const chemin = String(path).trim();
  const prefix = `${user.id}/`;
  if (
    !chemin.startsWith(prefix) ||
    !/^([0-9a-f-]{36})\/(avatar-[0-9a-f-]{36})\.(jpg|jpeg|png|webp)$/i.test(chemin)
  ) {
    return { ok: false as const, reason: "chemin" as const };
  }

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (readError || !profile) return { ok: false as const, reason: "profil" as const };

  const ancienChemin = profile.avatar_path?.trim() ?? "";
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_path: chemin })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  // La nouvelle image vient d'être téléversée par le client : une écriture DB
  // refusée ne doit jamais effacer cette donnée de récupération.
  if (updateError || !updated) return { ok: false as const, reason: "profil" as const };

  const ancienValide = ancienChemin !== chemin
    && ancienChemin.startsWith(prefix)
    && /^([0-9a-f-]{36})\/(avatar-[0-9a-f-]{36})\.(jpg|jpeg|png|webp)$/i.test(ancienChemin);
  if (ancienValide) {
    const { error: cleanupError } = await supabase.storage.from("avatars").remove([ancienChemin]);
    if (cleanupError) {
      revalidatePath("/profile");
      revalidatePath("/", "layout");
      return { ok: true as const, cleanup: "ancien-conserve" as const };
    }
  }
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true as const, cleanup: "termine" as const };
}

/** Retire la photo du profil courant, avec rollback si Storage refuse le retrait. */
export async function removeProfileAvatar() {
  const { supabase, user } = await requireUser();
  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .single();
  const chemin = profile?.avatar_path?.trim() ?? "";
  const prefix = `${user.id}/`;
  if (readError || !chemin || !chemin.startsWith(prefix) || !/^([0-9a-f-]{36})\/(avatar-[0-9a-f-]{36})\.(jpg|jpeg|png|webp)$/i.test(chemin)) {
    return { ok: false as const, reason: "absente" as const };
  }

  const { error: clearError } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id);
  if (clearError) return { ok: false as const, reason: "profil" as const };

  const { error: storageError } = await supabase.storage.from("avatars").remove([chemin]);
  if (storageError) {
    // Évite de laisser le profil vide si la suppression Storage n'a pas été acceptée.
    await supabase.from("profiles").update({ avatar_path: chemin }).eq("id", user.id);
    return { ok: false as const, reason: "storage" as const };
  }
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function login(formData: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  // Ne jamais réinjecter le message Supabase dans l'URL ou l'interface : il
  // varie selon le fournisseur et peut révéler des détails inutiles.
  if (error) redirect("/login?error=invalid-credentials");
  redirect(POST_AUTH_REDIRECT);
}

export async function logout() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createPost(formData: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  const type = String(formData.get("type") ?? "exhortation");
  const verse = String(formData.get("verse_ref") ?? "").trim();
  if (!body || !(await rateLimit(supabase, "post"))) return;
  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    type,
    body: body.slice(0, 4000),
    verse_ref: verse.slice(0, 80),
  });
  if (error) redirect("/feed?error=publication");
  await supabase.rpc("touch_streak");
  revalidatePath("/feed");
  redirect("/feed?posted=1");
}

export async function toggleAmen(postId: string) {
  const { supabase, user } = await requireUser();
  if (!(await rateLimit(supabase, "video_amen"))) return;
  const { error } = await supabase
    .from("amens")
    .insert({ post_id: postId, user_id: user.id });
  if (error) {
    await supabase.from("amens").delete().match({ post_id: postId, user_id: user.id });
  }
  revalidatePath("/feed");
}

export async function addComment(formData: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  const postId = String(formData.get("post_id") ?? "");
  if (!body || !postId || !(await rateLimit(supabase, "comment"))) return;
  await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    body: body.slice(0, 2000),
  });
  revalidatePath("/feed");
}

export async function createPrayerRequest(formData: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body || !(await rateLimit(supabase, "prayer_request"))) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("country")
    .eq("id", user.id)
    .single();
  await supabase.from("prayer_requests").insert({
    author_id: user.id,
    body: body.slice(0, 2000),
    anonymous: Boolean(formData.get("anonymous")),
    country: profile?.country ?? "FR",
  });
  recordProductEventAfter(supabase, { name: "first_prayer", surface: "prayer_request" });
  revalidatePath("/prayer");
}

export async function prayNow(requestId: string) {
  const { supabase, user } = await requireUser();
  if (!(await rateLimit(supabase, "prayer_action"))) return;
  const { data: profile } = await supabase
    .from("profiles")
    .select("country")
    .eq("id", user.id)
    .single();
  await supabase.from("prayer_actions").insert({
    request_id: requestId,
    user_id: user.id,
    country: profile?.country ?? "FR",
  });
  await supabase.rpc("touch_streak");
  recordProductEventAfter(supabase, { name: "first_prayer", surface: "prayer_action" });
  revalidatePath("/prayer");
  revalidatePath("/map");
}

export async function startSabbath() {
  const { supabase, user } = await requireUser();
  await supabase
    .from("profiles")
    .update({ sabbath_until: sabbathEnd().toISOString() })
    .eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/sabbath");
}

/** Désactive le Sabbat uniquement pour la session authentifiée courante. */
export async function endSabbath() {
  const { supabase, user } = await requireUser();
  await supabase
    .from("profiles")
    .update({ sabbath_until: null })
    .eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/feed");
}

export async function offerMentorship(formData: FormData) {
  if (!isEnabled("mentorship")) return;
  const { supabase, user } = await requireUser();
  if (!(await rateLimit(supabase, "follow"))) return;
  await supabase.from("mentor_offers").upsert({
    user_id: user.id,
    topics: String(formData.get("topics") ?? "").slice(0, 200),
  });
  revalidatePath("/mentorship");
}

export async function requestMentorship(mentorId: string) {
  if (!isEnabled("mentorship")) return;
  const { supabase, user } = await requireUser();
  if (mentorId === user.id || !(await rateLimit(supabase, "follow"))) return;
  await supabase.from("mentorships").insert({
    mentor_id: mentorId,
    mentee_id: user.id,
  });
  revalidatePath("/mentorship");
}

export async function addChurch(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await supabase.from("churches").insert({
    name: name.slice(0, 120),
    city: String(formData.get("city") ?? "").slice(0, 80),
    country: String(formData.get("country") ?? "FR").toUpperCase().slice(0, 2),
    created_by: user.id,
  });
  revalidatePath("/churches");
}

export async function reportPost(postId: string) {
  const { supabase, user } = await requireUser();
  if (!(await rateLimit(supabase, "report"))) return;
  await supabase.from("reports").insert({
    reporter_id: user.id,
    post_id: postId,
    reason: "signalement utilisateur",
  });
}

// ── Phase 2 ────────────────────────────────────────────────────────────────

export async function publishVideo(formData: FormData) {
  if (!isEnabled("video_publication")) {
    const supabase = await supabaseServer();
    recordProductEventAfter(supabase, {
      name: "action_refused",
      surface: "video_publish",
      outcome: "refused",
      reason: "suspended",
    });
    return { ok: false as const, reason: "suspendu" as const };
  }
  const { supabase, user } = await requireUser();
  if (!(await rateLimit(supabase, "video_publish"))) return { ok: false as const };
  const storagePath = String(formData.get("storage_path") ?? "");
  // Le chemin doit être exactement `<uid>/<nom-de-fichier>` : un préfixe seul
  // laisserait passer `<uid>/../<autre uid>/x.mp4`, que le navigateur
  // normaliserait vers le fichier d'un autre utilisateur.
  if (!/^[0-9a-f-]{36}\/[A-Za-z0-9-]+\.[a-z0-9]{2,5}$/i.test(storagePath)) {
    return { ok: false as const };
  }
  if (!storagePath.startsWith(`${user.id}/`)) return { ok: false as const };
  // Vignette optionnelle : mêmes règles que la vidéo (dossier de l'auteur,
  // nom simple), sinon on publie sans vignette plutôt que d'échouer.
  const thumbBrut = String(formData.get("thumb_path") ?? "");
  const thumbPath =
    /^[0-9a-f-]{36}\/[A-Za-z0-9-]+\.jpg$/i.test(thumbBrut) &&
    thumbBrut.startsWith(`${user.id}/`)
      ? thumbBrut
      : null;
  const { error } = await supabase.from("videos").insert({
    author_id: user.id,
    storage_path: storagePath,
    thumb_path: thumbPath,
    caption: String(formData.get("caption") ?? "").slice(0, 500),
    verse_ref: String(formData.get("verse_ref") ?? "").slice(0, 80),
    type: String(formData.get("type") ?? "temoignage"),
    duration_s: Math.min(Number(formData.get("duration_s") ?? 0) || 0, 300),
  });
  if (error) {
    // Une réponse réseau perdue après l'INSERT ne doit pas produire une seconde
    // vidéo au retry : le même chemin de stockage identifie l'opération.
    if (error.code !== "23505") return { ok: false as const };
    const { data: existing, error: lookupError } = await supabase
      .from("videos")
      .select("id")
      .eq("author_id", user.id)
      .eq("storage_path", storagePath)
      .maybeSingle();
    if (lookupError || !existing) return { ok: false as const };
  }
  await supabase.rpc("touch_streak");
  recordProductEventAfter(supabase, { name: "first_publish", surface: "video_publish" });
  revalidatePath("/videos");
  revalidatePath("/");
  return { ok: true as const };
}

export async function toggleVideoAmen(videoId: string) {
  const { supabase, user } = await requireUser();
  if (!(await rateLimit(supabase, "video_amen"))) return { ok: false as const };
  const { error } = await supabase
    .from("video_amens")
    .insert({ video_id: videoId, user_id: user.id });
  if (error) {
    // Doublon = retrait (toggle). Toute autre erreur (vidéo supprimée, RLS)
    // doit remonter au client pour annuler son état optimiste.
    if (error.code !== "23505") return { ok: false as const };
    const { error: delError } = await supabase
      .from("video_amens")
      .delete()
      .match({ video_id: videoId, user_id: user.id });
    if (delError) return { ok: false as const };
  }
  // Pas de revalidatePath("/") : l'UI du feed est optimiste, et régénérer la
  // page entière à chaque amen coûterait un aller-retour RSC inutile.
  revalidatePath("/videos");
  return { ok: true as const };
}

export async function addVideoComment(videoId: string, body: string) {
  const { supabase, user } = await requireUser();
  const texte = body.trim();
  if (!texte || !(await rateLimit(supabase, "video_comment"))) return { ok: false as const };
  const { data, error } = await supabase
    .from("video_comments")
    .insert({
      video_id: videoId,
      author_id: user.id,
      body: texte.slice(0, 2000),
    })
    .select("id, body, created_at")
    .single();
  if (error || !data) return { ok: false as const };
  await supabase.rpc("touch_streak");
  revalidatePath("/videos");
  return { ok: true as const, comment: data };
}

export async function deleteVideoComment(commentId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("video_comments")
    .delete()
    .match({ id: commentId, author_id: user.id });
  return { ok: !error };
}

export async function toggleFollow(authorId: string) {
  const { supabase, user } = await requireUser();
  if (authorId === user.id || !(await rateLimit(supabase, "follow"))) return { ok: false as const };
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, followed_id: authorId });
  if (error) {
    // Déjà abonné (violation d'unicité) : le geste vaut désabonnement.
    if (error.code !== "23505") return { ok: false as const };
    const { error: delError } = await supabase
      .from("follows")
      .delete()
      .match({ follower_id: user.id, followed_id: authorId });
    if (delError) return { ok: false as const };
    return { ok: true as const, following: false };
  }
  return { ok: true as const, following: true };
}

export async function prayForVideo(videoId: string) {
  const { supabase, user } = await requireUser();
  if (!(await rateLimit(supabase, "video_prayer"))) return { ok: false as const };
  const { data: profile } = await supabase
    .from("profiles")
    .select("country")
    .eq("id", user.id)
    .single();
  const { error } = await supabase.from("video_prayers").insert({
    video_id: videoId,
    user_id: user.id,
    country: profile?.country ?? "FR",
  });
  // 23505 = déjà prié pour cette vidéo : intention déjà enregistrée, succès.
  if (error && error.code !== "23505") return { ok: false as const };
  const dejaPrie = Boolean(error);
  if (!dejaPrie) await supabase.rpc("touch_streak");
  revalidatePath("/map");
  return { ok: true as const, dejaPrie };
}

export async function reportVideo(videoId: string) {
  const { supabase, user } = await requireUser();
  if (!(await rateLimit(supabase, "report"))) return { ok: false as const };
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    video_id: videoId,
    reason: "signalement utilisateur",
  });
  return { ok: !error };
}

/** Masquer ou rétablir une vidéo. Réservé aux modérateurs et admins : la
 *  policy RLS `modérer une vidéo` tranche côté base, on vérifie aussi ici
 *  pour renvoyer un refus explicite plutôt qu'un échec muet. */
export async function setVideoHidden(videoId: string, hidden: boolean) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["moderateur", "admin"].includes(profile.role)) {
    return { ok: false as const };
  }
  const { error } = await supabase
    .from("videos")
    .update({ hidden })
    .eq("id", videoId);
  if (error) return { ok: false as const };
  revalidatePath("/moderation");
  revalidatePath("/");
  return { ok: true as const };
}

export async function resolveReport(reportId: string) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["moderateur", "admin"].includes(profile.role)) {
    return { ok: false as const };
  }
  const { error } = await supabase
    .from("reports")
    .update({ status: "traite" })
    .eq("id", reportId);
  if (error) return { ok: false as const };
  revalidatePath("/moderation");
  return { ok: true as const };
}

export async function openPrayerRoom(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 3 || !(await rateLimit(supabase, "room_create"))) return;
  const { data } = await supabase
    .from("prayer_rooms")
    .insert({
      title: title.slice(0, 120),
      topic: String(formData.get("topic") ?? "").slice(0, 200),
      host_id: user.id,
    })
    .select("id")
    .single();
  revalidatePath("/rooms");
  if (data) redirect(`/rooms/${data.id}`);
}

export async function closePrayerRoom(roomId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("prayer_rooms")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("host_id", user.id);
  revalidatePath("/rooms");
}

export async function createChallenge(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const days = Number(formData.get("days") ?? 0);
  if (
    title.length < 3 ||
    !Number.isFinite(days) ||
    days < 1 ||
    days > 365 ||
    !(await rateLimit(supabase, "challenge_create"))
  ) return;
  await supabase.from("challenges").insert({
    title: title.slice(0, 120),
    description: String(formData.get("description") ?? "").slice(0, 1000),
    days: Math.trunc(days),
    starts_on: String(formData.get("starts_on") ?? "") || new Date().toISOString().slice(0, 10),
    created_by: user.id,
  });
  revalidatePath("/challenges");
}

export async function checkInChallenge(challengeId: string) {
  const { supabase, user } = await requireUser();
  // Doublon du jour : la clé primaire (défi, membre, jour) le refuse. C'est
  // l'effet voulu — on pointe une fois par jour.
  await supabase
    .from("challenge_checkins")
    .insert({ challenge_id: challengeId, user_id: user.id });
  await supabase.rpc("touch_streak");
  revalidatePath("/challenges");
}

export async function joinChurch(formData: FormData) {
  const { supabase, user } = await requireUser();
  const churchId = String(formData.get("church_id") ?? "");
  await supabase
    .from("profiles")
    .update({ church_id: churchId || null })
    .eq("id", user.id);
  revalidatePath("/churches");
  revalidatePath("/pastor");
}
