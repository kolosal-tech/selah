import Link from "next/link";
import { headers } from "next/headers";
import { signup } from "@/app/actions";
import { Sparkles } from "lucide-react";
import { getMessages } from "@/i18n/server";
import { SelecteurLangue } from "@/app/selecteur-langue";
import { PasswordField } from "@/app/auth/password-field";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-password";
import { ChampPays } from "./champ-pays";

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const m = await getMessages();
  const entetes = await headers();
  const paysDetecte = entetes.get("x-vercel-ip-country");
  const erreurs: Record<string, string> = {
    charte: m.auth.erreurCharte,
    nom: m.auth.erreurUsername,
    age: m.age.erreurInscription,
    "trop-de-tentatives": m.auth.tropDeTentatives,
  };
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col justify-start gap-6 overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] scroll-py-4 sm:justify-center sm:py-6">
      <div>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
            <Sparkles className="h-4 w-4" />
            <span>Selah</span>
          </p>
          <SelecteurLangue compact />
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          {m.auth.rejoindreReveil}
        </h1>
      </div>
      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-sm text-rose-300">
          {erreurs[error] ?? error}
        </p>
      )}
      <form action={signup} className="flex flex-col gap-3">
        {/* Un prénom, rien de plus. Pas de `pattern` : la seule contrainte
            est d'écrire quelque chose, et elle vaut pour toutes les
            écritures — « Aïcha », « 마리아 » et « Marie-Claire » passent.
            L'identifiant technique est dérivé côté serveur. */}
        <div className="flex flex-col gap-1">
          <input
            name="nom"
            required
            minLength={2}
            maxLength={40}
            autoComplete="given-name"
            placeholder={m.auth.nomUtilisateur}
            title={m.auth.nomUtilisateurTitre}
            className="glass-input rounded-xl p-3 placeholder:text-white/40"
          />
          <p className="px-1 text-xs text-white/45">{m.auth.nomUtilisateurAide}</p>
        </div>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={m.auth.email}
          className="glass-input rounded-xl p-3 placeholder:text-white/40"
        />
        <PasswordField
          name="password"
          label={m.auth.motDePasseMin}
          placeholder={m.auth.motDePasseMin}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
        />
        <ChampPays paysDetecte={paysDetecte} />
        <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-white/80">
          <input type="checkbox" name="charte" required className="mt-1 accent-amber-500" />
          <span>
            <strong className="text-amber-200">{m.auth.charteTitre}</strong> :{" "}
            {m.auth.charteTexte}
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-white/80">
          <input type="checkbox" name="age_attestation" required className="mt-1 accent-sky-400" />
          <span>
            <strong className="text-sky-200">{m.age.titre}</strong> : {m.age.inscription}
            <span className="mt-1 block text-xs text-white/60">{m.age.inscriptionAide}</span>
          </span>
        </label>
        <button className="btn-paradise min-h-11 rounded-xl p-3 font-bold transition hover:scale-[1.02]">
          {m.auth.creerCompte}
        </button>
      </form>
      <p className="text-sm text-white/60">
        {m.auth.dejaMembre}{" "}
        <Link href="/login" className="font-semibold text-amber-300 hover:text-amber-200">
          {m.auth.seConnecter}
        </Link>
      </p>
    </main>
  );
}
