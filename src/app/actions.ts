"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { sabbathEnd } from "@/lib/sabbath";

async function requireUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const country = String(formData.get("country") ?? "FR").toUpperCase().slice(0, 2);
  if (!formData.get("charte")) {
    redirect("/signup?error=charte");
  }
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    redirect("/signup?error=username");
  }
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, country } },
  });
  if (error || !data.user)
    redirect(`/signup?error=${encodeURIComponent(error?.message ?? "inconnu")}`);
  // Le profil est créé par le trigger handle_new_user (avec ou sans confirmation email).
  if (!data.session) redirect("/login?info=confirm");
  redirect("/");
}

export async function login(formData: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
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
  if (!body) return;
  await supabase.from("posts").insert({
    author_id: user.id,
    type,
    body: body.slice(0, 4000),
    verse_ref: verse.slice(0, 80),
  });
  await supabase.rpc("touch_streak");
  revalidatePath("/feed");
}

export async function toggleAmen(postId: string) {
  const { supabase, user } = await requireUser();
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
  if (!body || !postId) return;
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
  if (!body) return;
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
  revalidatePath("/prayer");
}

export async function prayNow(requestId: string) {
  const { supabase, user } = await requireUser();
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

export async function offerMentorship(formData: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("mentor_offers").upsert({
    user_id: user.id,
    topics: String(formData.get("topics") ?? "").slice(0, 200),
  });
  revalidatePath("/mentorship");
}

export async function requestMentorship(mentorId: string) {
  const { supabase, user } = await requireUser();
  if (mentorId === user.id) return;
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
  await supabase.from("reports").insert({
    reporter_id: user.id,
    post_id: postId,
    reason: "signalement utilisateur",
  });
}

// ── Phase 2 ────────────────────────────────────────────────────────────────

export async function publishVideo(formData: FormData) {
  const { supabase, user } = await requireUser();
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
  if (error) return { ok: false as const };
  await supabase.rpc("touch_streak");
  revalidatePath("/videos");
  revalidatePath("/");
  return { ok: true as const };
}

export async function toggleVideoAmen(videoId: string) {
  const { supabase, user } = await requireUser();
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
  if (!texte) return { ok: false as const };
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
  if (authorId === user.id) return { ok: false as const };
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
  if (title.length < 3) return;
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
  if (title.length < 3 || !Number.isFinite(days) || days < 1 || days > 365) return;
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
