import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { ProfilePhotoForm } from "./profile-photo-form";
import { getMessages } from "@/i18n/server";
import { SelecteurLangue } from "@/app/selecteur-langue";
import { AppPreferences } from "./app-preferences";
import { attestAge18 } from "@/app/actions";

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_path")
    .eq("id", user.id)
    .single();
  const { data: signed } = profile?.avatar_path
    ? await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600)
    : { data: null };
  const { data: attestation } = await supabase
    .from("age_attestations")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const m = await getMessages();

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gradient-gold tracking-tight">{m.commun.profil}</h1>
        <p className="mt-1 text-sm text-white/70">@{profile?.username ?? m.commun.disciple}</p>
      </div>
      <section className="glass-card flex flex-col items-center gap-5 p-6">
        <h2 className="text-lg font-bold text-white">{m.commun.photoProfil}</h2>
        <ProfilePhotoForm currentUrl={signed?.signedUrl ?? null} />
      </section>
      <section className="glass-card flex flex-col gap-4 p-5" aria-labelledby="profile-settings-title">
        <div>
          <h2 id="profile-settings-title" className="text-lg font-bold text-white">{m.commun.profil}</h2>
          <p className="mt-1 text-sm text-white/60">{m.auth.email}: {user.email ?? "—"}</p>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <span className="text-sm text-white/80">{m.commun.langue}</span>
          <SelecteurLangue />
        </div>
        <p className="text-xs leading-relaxed text-white/50">{m.commun.photoAide}</p>
      </section>
      <section className="glass-card flex flex-col gap-3 p-5" aria-labelledby="profile-blocked-title">
        <div>
          <h2 id="profile-blocked-title" className="text-lg font-bold text-white">
            {m.distance.titre}
          </h2>
          <p className="mt-1 text-sm text-white/60">{m.distance.aide}</p>
        </div>
        <Link
          href="/profile/blocked"
          className="btn-paradise inline-flex min-h-11 items-center justify-center self-start rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          {m.distance.gerer}
        </Link>
      </section>
      <section className="glass-card flex flex-col gap-3 p-5" aria-labelledby="profile-age-title">
        <div>
          <h2 id="profile-age-title" className="text-lg font-bold text-white">{m.age.titre}</h2>
          <p className="mt-1 text-sm text-white/60">{attestation ? m.age.attestee : m.age.profilAide}</p>
        </div>
        {!attestation && (
          <form action={attestAge18}>
            <button className="btn-paradise min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold">
              {m.age.attester}
            </button>
          </form>
        )}
      </section>
      <section className="glass-card flex flex-col gap-3 p-5" aria-labelledby="profile-safety-title">
        <div><h2 id="profile-safety-title" className="text-lg font-bold text-white">Sécurité du compte</h2><p className="mt-1 text-sm text-white/60">Consulte tes mesures de modération et dépose un appel si nécessaire.</p></div>
        <Link href="/profile/safety" className="btn-paradise inline-flex min-h-11 items-center justify-center self-start rounded-full px-5 py-2.5 text-sm font-semibold">Voir mes mesures</Link>
      </section>
      <section className="glass-card flex flex-col gap-3 p-5" aria-labelledby="profile-account-title">
        <div><h2 id="profile-account-title" className="text-lg font-bold text-white">Compte et données</h2><p className="mt-1 text-sm text-white/60">Exporte tes données, gère les sessions ou planifie une suppression réversible.</p></div>
        <Link href="/profile/account" className="btn-paradise inline-flex min-h-11 items-center justify-center self-start rounded-full px-5 py-2.5 text-sm font-semibold">Gérer mon compte</Link>
      </section>
      <AppPreferences />
    </main>
  );
}
