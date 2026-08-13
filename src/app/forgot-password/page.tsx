import Link from "next/link";
import { Sparkles } from "lucide-react";
import { demanderReinitialisation } from "@/app/auth/password-actions";
import { SelecteurLangue } from "@/app/selecteur-langue";
import { getMessages } from "@/i18n/server";

export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;
  const m = await getMessages();
  const erreurs: Record<string, string> = {
    email: m.auth.emailInvalide,
    service: m.auth.demandeReinitialisationErreur,
    link: m.auth.lienReinitialisationInvalide,
    "trop-de-tentatives": m.auth.tropDeTentatives,
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
          {m.auth.reinitialiserTitre}
        </h1>
        <p className="mt-2 text-sm text-white/60">{m.auth.reinitialiserAide}</p>
      </div>

      {info === "accepted" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3 text-sm text-amber-100">
          {m.auth.demandeReinitialisationAcceptee}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-sm text-rose-300">
          {erreurs[error] ?? m.auth.demandeReinitialisationErreur}
        </p>
      )}

      <form action={demanderReinitialisation} className="flex flex-col gap-3">
        <label htmlFor="reset-email" className="sr-only">
          {m.auth.email}
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={m.auth.email}
          className="glass-input rounded-xl p-3 placeholder:text-white/40"
        />
        <button className="btn-paradise rounded-xl p-3 font-bold transition hover:scale-[1.02]">
          {m.auth.envoyerLien}
        </button>
      </form>

      <Link
        href="/login"
        className="text-sm font-semibold text-amber-300 hover:text-amber-200"
      >
        {m.auth.retourConnexion}
      </Link>
    </main>
  );
}
