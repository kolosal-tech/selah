import Link from "next/link";
import { headers } from "next/headers";
import { signup } from "@/app/actions";
import { Sparkles } from "lucide-react";
import { getMessages } from "@/i18n/server";
import { SelecteurLangue } from "@/app/selecteur-langue";
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
  };
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
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
          placeholder={m.auth.email}
          className="glass-input rounded-xl p-3 placeholder:text-white/40"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder={m.auth.motDePasseMin}
          className="glass-input rounded-xl p-3 placeholder:text-white/40"
        />
        <ChampPays paysDetecte={paysDetecte} />
        <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-white/80">
          <input type="checkbox" name="charte" required className="mt-1 accent-amber-500" />
          <span>
            <strong className="text-amber-200">{m.auth.charteTitre}</strong> :{" "}
            {m.auth.charteTexte}
          </span>
        </label>
        <button className="btn-paradise rounded-xl p-3 font-bold transition hover:scale-[1.02]">
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
