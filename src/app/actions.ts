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
  redirect("/feed");
}

export async function login(formData: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/feed");
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
