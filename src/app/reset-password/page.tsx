import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PasswordField } from "@/app/auth/password-field";
import { enregistrerNouveauMotDePasse } from "@/app/auth/password-actions";
import { SelecteurLangue } from "@/app/selecteur-langue";
import { getMessages } from "@/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-password";

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const m = await getMessages();
  let sessionValide = false;

  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    sessionValide = Boolean(user);
  } catch {
    sessionValide = false;
  }

  const erreurs: Record<string, string> = {
    length: m.auth.motDePasseTropCourt,
    mismatch: m.auth.motsDePasseDifferents,
    session: m.auth.sessionReinitialisationAbsente,
    update: m.auth.motDePasseRefuse,
    service: m.auth.demandeReinitialisationErreur,
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
            <Sparkles className="h-4 w-4" />
            <span>Selah</span>
          </p>
          <SelecteurLangue compact />
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          {m.auth.nouveauMotDePasseTitre}
        </h1>
      </div>

      {(error || !sessionValide) && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-sm text-rose-300">
          {error
            ? (erreurs[error] ?? m.auth.demandeReinitialisationErreur)
            : m.auth.sessionReinitialisationAbsente}
        </p>
      )}

      {sessionValide ? (
        <form action={enregistrerNouveauMotDePasse} className="flex flex-col gap-3">
          <PasswordField
            name="password"
            label={m.auth.nouveauMotDePasse}
            placeholder={m.auth.nouveauMotDePasse}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />
          <PasswordField
            name="password_confirmation"
            label={m.auth.confirmerMotDePasse}
            placeholder={m.auth.confirmerMotDePasse}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />
          <button className="btn-paradise rounded-xl p-3 font-bold transition hover:scale-[1.02]">
            {m.auth.enregistrerMotDePasse}
          </button>
        </form>
      ) : (
        <Link
          href="/forgot-password"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-sm font-semibold text-amber-200 hover:bg-amber-500/15"
        >
          {m.auth.redemanderLien}
        </Link>
      )}
    </main>
  );
}
