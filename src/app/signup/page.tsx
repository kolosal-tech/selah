import Link from "next/link";
import { signup } from "@/app/actions";
import { Sparkles } from "lucide-react";

const ERRORS: Record<string, string> = {
  charte: "Tu dois accepter la charte spirituelle pour rejoindre Selah.",
  username: "Nom d'utilisateur : 3 à 30 caractères, lettres/chiffres/underscore.",
};

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
          <Sparkles className="h-4 w-4" />
          <span>Selah</span>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Rejoindre le Réveil
        </h1>
      </div>
      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-sm text-rose-300">
          {ERRORS[error] ?? error}
        </p>
      )}
      <form action={signup} className="flex flex-col gap-3">
        <input
          name="username"
          required
          placeholder="Nom d'utilisateur"
          pattern="[a-zA-Z0-9_]{3,30}"
          className="glass-input rounded-xl p-3 placeholder:text-white/40"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="glass-input rounded-xl p-3 placeholder:text-white/40"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Mot de passe (8 caractères min.)"
          className="glass-input rounded-xl p-3 placeholder:text-white/40"
        />
        <input
          name="country"
          maxLength={2}
          placeholder="Pays (code, ex. FR, CI, CD)"
          className="glass-input rounded-xl p-3 uppercase placeholder:text-white/40"
        />
        <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-white/80">
          <input type="checkbox" name="charte" required className="mt-1 accent-amber-500" />
          <span>
            <strong className="text-amber-200">Charte spirituelle</strong> : je
            m&apos;engage à édifier, non à détruire ; à parler avec grâce et
            vérité ; à respecter chaque frère et sœur ; à ne rien publier de
            contraire à l&apos;Évangile. (Éph. 4:29)
          </span>
        </label>
        <button className="btn-paradise rounded-xl p-3 font-bold transition hover:scale-[1.02]">
          Créer mon compte
        </button>
      </form>
      <p className="text-sm text-white/60">
        Déjà membre ?{" "}
        <Link href="/login" className="font-semibold text-amber-300 hover:text-amber-200">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
