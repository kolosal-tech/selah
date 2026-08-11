import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath: string) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

describe("baseline de sécurité", () => {
  it("applique la CSP et exclut les artefacts Playwright sensibles", async () => {
    const nextConfig = await source("next.config.ts");
    const gitignore = await source(".gitignore");

    expect(nextConfig).toContain('key: "Content-Security-Policy"');
    expect(nextConfig).not.toContain("Content-Security-Policy-Report-Only");
    expect(nextConfig).toContain('process.env.NODE_ENV === "development"');
    expect(gitignore).toContain("/playwright-report/");
    expect(gitignore).toContain("/test-results/");
  });

  it("verrouille l'analytique produit sans donnée personnelle", async () => {
    const migration = await source(
      "supabase/migrations/20260811120000_product_analytics.sql",
    );

    // Aucun chemin de lecture ni d'écriture directe : la RPC est le seul accès.
    expect(migration).toContain(
      "revoke all on public.product_events from anon, authenticated",
    );
    expect(migration).toContain("using (false)");
    expect(migration).toContain("with check (false)");
    // Les fonctions élevées vivent hors du schéma exposé, search_path figé.
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("on delete cascade");
    // Aucune colonne libre : un texte de prière ne peut pas y entrer.
    expect(migration).not.toContain("jsonb");
    expect(migration).not.toMatch(/^\s+(payload|body|content|label)\s+text/m);
    // Aucune diffusion Realtime de cette table.
    expect(migration).not.toContain("supabase_realtime");
  });

  it("n'expose aucun déclencheur automatique de CI facturable", async () => {
    const ci = await source(".github/workflows/ci.yml");

    // Dépôt privé : chaque exécution consomme des minutes facturables. La
    // validation courante se fait en local, la CI ne sert qu'aux jalons.
    expect(ci).toContain("workflow_dispatch:");
    expect(ci).not.toMatch(/^\s*pull_request:/m);
    expect(ci).not.toMatch(/^\s*push:/m);
    expect(ci).not.toMatch(/^\s*schedule:/m);
  });

  it("corrige les advisors critiques et indexe les clés étrangères", async () => {
    const migration = await source(
      "supabase/migrations/20260810231500_security_performance_advisors.sql",
    );

    expect(migration).toContain("security_invoker = true");
    expect(migration).toContain("private.prayer_requests_public_rows");
    expect(migration).toContain("revoke all on function public.bump_video_comment()");
    expect(migration).toContain("replace(p.qual, 'auth.uid()', '(select auth.uid())')");
    expect(migration).toContain("videos_author_id_idx");
    expect(migration).toContain("room_audio_signals_sender_idx");
  });

  it("retire les écritures client sur le rôle et les champs système", async () => {
    const migration = await source("supabase/migrations/0009_security_baseline.sql");
    expect(migration).toContain("revoke update on public.profiles from anon, authenticated");
    expect(migration).toContain("grant update (username, display_name, bio, country, lang, church_id, sabbath_until)");
    expect(migration).not.toContain("grant update (role");
  });

  it("ne sert plus author_id dans la vue de prière publique", async () => {
    const migration = await source("supabase/migrations/0009_security_baseline.sql");
    expect(migration).toContain("revoke select on public.prayer_requests from anon, authenticated");
    expect(migration).toContain("create or replace view public.prayer_requests_public");
    expect(migration).toContain("case when r.anonymous then null else p.username end as username");
  });

  it("utilise des URLs signées pour les médias du feed", async () => {
    const feed = await source("src/app/vertical-feed.tsx");
    const home = await source("src/app/page.tsx");
    expect(feed).toContain('createSignedUrls(paths, 60)');
    expect(home).toContain('createSignedUrls(paths, 60)');
    expect(feed).not.toContain("/storage/v1/object/public/videos/");
  });

  it("retire les colonnes système des insertions vidéo client", async () => {
    const migration = await source("supabase/migrations/0009_security_baseline.sql");
    expect(migration).toContain("revoke insert on public.videos from anon, authenticated");
    expect(migration).toContain("grant insert (author_id, storage_path, thumb_path, caption, verse_ref, type, duration_s)");
    expect(migration).not.toContain("grant insert (author_id, storage_path, hidden");
  });

  it("autorise seulement la reprise idempotente des uploads dans le dossier propriétaire", async () => {
    const migration = await source("supabase/migrations/0009_security_baseline.sql");
    const studio = await source("src/app/(app)/videos/upload-form.tsx");
    const batch = await source("src/app/(app)/videos/depot-lot.tsx");
    expect(migration).toContain("videos mise à jour de ses fichiers");
    expect(migration).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    expect(studio).toContain("upsert: true");
    expect(studio).toContain(".remove([cheminVideo");
    expect(batch).toContain("uploadId: crypto.randomUUID()");
    expect(batch).toContain(".remove([chemin,");
  });

  it("contraint les signalements et rend le compteur de commentaires symétrique", async () => {
    const migration = await source("supabase/migrations/0011_reports_and_counter_integrity.sql");
    expect(migration).toContain("num_nonnulls(post_id, comment_id, video_id) = 1");
    expect(migration).toContain("char_length(btrim(reason)) between 3 and 500");
    expect(migration).toContain("after insert or delete on public.comments");
    expect(migration).toContain("greatest(comment_count - 1, 0)");
  });

  it("centralise les limites par compte et couvre les messages Realtime", async () => {
    const migration = await source("supabase/migrations/0012_rate_limits.sql");
    const actions = await source("src/app/actions.ts");
    const translate = await source("src/app/api/translate/route.ts");
    expect(migration).toContain("primary key (actor_id, scope)");
    expect(migration).toContain("on conflict (actor_id, scope) do update");
    expect(migration).toContain("public.consume_rate_limit('room_message')");
    expect(actions).toContain('supabase.rpc("consume_rate_limit"');
    expect(actions).toContain('rateLimit(supabase, "video_publish")');
    expect(translate).toContain('p_scope: "translation"');
    expect(translate).not.toContain("new Map");
  });

  it("reconstruit toutes les migrations dans une base PostgreSQL vierge", async () => {
    const reconstruction = await source("tests/schema-reconstruction.sql");
    expect(reconstruction).toContain("0001_selah_core.sql");
    expect(reconstruction).toContain("0016_reenable_video_mentorship.sql");
    expect(reconstruction).toContain("20260807093647_selah_core.sql");
    expect(reconstruction).toContain("20260808191926_inscription_prenom_ou_pseudo.sql");
    expect(reconstruction).toContain("video_translations absente après reconstruction");
    expect(reconstruction).toContain("verse_text absent après réconciliation");
  });

  it("conserve les signalements et journalise les décisions de modération", async () => {
    const migration = await source("supabase/migrations/0014_moderation_audit.sql");
    expect(migration).toContain("on delete set null");
    expect(migration).toContain("moderation_events");
    expect(migration).toContain("report_status_changed");
    expect(migration).toContain("video_hidden_changed");
  });

  it("prépare une réconciliation média réservée à la modération", async () => {
    const migration = await source("supabase/migrations/0013_media_reconciliation.sql");
    expect(migration).toContain("video_storage_orphans");
    expect(migration).toContain("video_storage_missing");
    expect(migration).toContain("p.role in ('moderateur', 'admin')");
  });

  it("applique la pause sécurisée des nouveaux mentorats et dépôts vidéo", async () => {
    const migration = await source("supabase/migrations/0015_safety_default_pause.sql");
    expect(migration).toContain('drop policy if exists "proposer mentorat"');
    expect(migration).toContain("revoke insert, update on public.mentorships from authenticated");
    expect(migration).toContain('drop policy if exists "publier une vidéo"');
    expect(migration).toContain("revoke insert on public.videos from authenticated");
    expect(migration).toContain("revoke insert, update, delete on storage.objects from authenticated");
  });

  it("réactive les parcours sous contrôle serveur et RLS", async () => {
    const migration = await source("supabase/migrations/0016_reenable_video_mentorship.sql");
    const actions = await source("src/app/actions.ts");
    const mentorship = await source("src/app/(app)/mentorship/page.tsx");
    const videos = await source("src/app/(app)/videos/page.tsx");
    expect(migration).toContain('create policy "publier une vidéo"');
    expect(migration).toContain('create policy "videos mise à jour de ses fichiers"');
    expect(migration).toContain('create policy "proposer mentorat"');
    expect(migration).toContain("grant insert (author_id, storage_path, thumb_path, caption, verse_ref, type, duration_s)");
    // Les deux constantes historiques sont devenues des flags typés, avec le
    // même défaut ouvert : la réactivation de `0016` reste vraie côté serveur.
    const flags = await source("src/lib/flags.ts");
    expect(actions).toContain('isEnabled("mentorship")');
    expect(actions).toContain('isEnabled("video_publication")');
    expect(flags).toContain("mentorship: true");
    expect(flags).toContain("video_publication: true");
    expect(actions).toContain('rateLimit(supabase, "follow")');
    expect(mentorship).toContain("offerMentorship");
    expect(videos).toContain("UploadForm");
  });

  it("utilise un curseur de feed plutôt qu'un offset", async () => {
    const feed = await source("src/app/vertical-feed.tsx");
    const home = await source("src/app/page.tsx");
    expect(feed).toContain("feedCursorFilter(videos.at(-1))");
    expect(feed).not.toContain(".range(depuis");
    expect(home).toContain('.order("id", { ascending: true })');
  });

  it("place les vidéos en premier sur mobile et après connexion", async () => {
    const nav = await source("src/app/nav-components.tsx");
    const actions = await source("src/app/actions.ts");
    expect(nav).toContain('item.href === "/"');
    expect(nav).toContain("order-first md:order-none");
    expect(nav).toContain('item.href === "/feed"');
    expect(nav).toContain("md:order-first");
    expect(actions).toContain('const POST_AUTH_REDIRECT = "/"');
    expect(actions).toContain("redirect(POST_AUTH_REDIRECT)");
  });

  it("rend l'état sonore explicite et accessible", async () => {
    const feed = await source("src/app/vertical-feed.tsx");
    expect(feed).toContain('aria-pressed={!muted}');
    expect(feed).toContain("border-rose-400/70 text-rose-400");
    expect(feed).toContain('"border-white/25 text-white"');
    expect(feed).toContain("gap-3 sm:gap-4");
  });

  it("expose des contrôles desktop pour les onglets débordants", async () => {
    const nav = await source("src/app/nav-components.tsx");
    expect(nav).toContain("canScrollPrev");
    expect(nav).toContain("canScrollNext");
    expect(nav).toContain("scrollChips(-1)");
    expect(nav).toContain("scrollChips(1)");
    expect(nav).toContain('aria-label={m.nav.precedent}');
    expect(nav).toContain('aria-label={m.nav.suivant}');
    expect(nav).toContain("disabled={!canScrollPrev}");
    expect(nav).toContain("disabled={!canScrollNext}");
    expect(nav).toContain("md:flex");
  });

  it("donne une couleur sémantique aux raccourcis secondaires", async () => {
    const nav = await source("src/app/nav-components.tsx");
    expect(nav).toContain('href: "/map", label: m.nav.carte, icon: Globe, iconClass: "text-violet-300"');
    expect(nav).toContain('iconClass: "text-sky-300"');
    expect(nav).toContain('iconClass: "text-emerald-300"');
    expect(nav).toContain('iconClass: "text-indigo-300"');
    expect(nav).toContain('iconClass: "text-rose-300"');
    expect(nav).toContain('iconClass: "text-slate-200"');
    expect(nav).toContain("item.iconClass");
  });

  it("charge les commentaires vidéo avec auteurs et expose la publication audio/vidéo", async () => {
    const feed = await source("src/app/vertical-feed.tsx");
    expect(feed).toContain('.select("id, body, created_at, author_id, profiles(username)")');
    expect(feed).toContain('aria-label={m.video.publierVideoAudio}');
    expect(feed).toContain("<span>{m.commun.publier}</span>");
  });

  it("ouvre la liste publique des profils ayant dit Amen", async () => {
    const feed = await source("src/app/vertical-feed.tsx");
    expect(feed).toContain('.from("video_amens")');
    expect(feed).toContain('aria-label={m.video.quiAditAmen}');
    expect(feed).toContain('.select("user_id, profiles(username)")');
    expect(feed).toContain("setAmenOuverte");
  });

  it("protège les avatars et expose le profil depuis l'en-tête", async () => {
    const migration = await source("supabase/migrations/0017_profile_avatars.sql");
    const layout = await source("src/app/(app)/layout.tsx");
    const profile = await source("src/app/(app)/profile/profile-photo-form.tsx");
    expect(migration).toContain("alter table public.profiles add column if not exists avatar_path");
    expect(migration).toContain('bucket_id = \'avatars\'');
    expect(migration).toContain("grant update (avatar_path)");
    expect(layout).toContain('href="/profile"');
    expect(profile).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(profile).toContain("5 * 1024 * 1024");
  });

  it("borne la suppression d'avatar au propriétaire", async () => {
    const migration = await source("supabase/migrations/0018_profile_avatar_delete.sql");
    const actions = await source("src/app/actions.ts");
    expect(migration).toContain('for delete to authenticated');
    expect(migration).toContain("storage.foldername(name))[1] = auth.uid()::text");
    expect(actions).toContain("export async function removeProfileAvatar()");
    expect(actions).toContain('update({ avatar_path: null })');
  });

  it("rend visibles les commentaires du Fil et sépare Amen de leur liste", async () => {
    const feed = await source("src/app/(app)/feed/page.tsx");
    const actions = await source("src/app/actions.ts");
    expect(feed).toContain('.from("comments")');
    expect(feed).toContain('aria-label={m.feed.commentaires(post.comment_count)}');
    expect(feed).toContain("@{usernames.get(comment.author_id)");
    expect(feed).toContain("<details className=\"relative\">");
    expect(feed).toContain("aria-label={m.feed.amen}");
    expect(actions).toContain('redirect("/feed?posted=1")');
    expect(feed).toContain("m.feed.publicationOk");
  });
});
