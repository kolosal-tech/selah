import Link from "next/link";
import { signup } from "@/app/actions";

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
      <h1 className="text-3xl font-bold text-stone-900">Rejoindre le Réveil</h1>
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {ERRORS[error] ?? error}
        </p>
      )}
      <form action={signup} className="flex flex-col gap-3">
        <input
          name="username"
          required
          placeholder="Nom d'utilisateur"
          pattern="[a-zA-Z0-9_]{3,30}"
          className="rounded-lg border border-stone-300 bg-white p-3"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-lg border border-stone-300 bg-white p-3"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Mot de passe (8 caractères min.)"
          className="rounded-lg border border-stone-300 bg-white p-3"
        />
        <input
          name="country"
          maxLength={2}
          placeholder="Pays (code, ex. FR, CI, CD)"
          className="rounded-lg border border-stone-300 bg-white p-3 uppercase"
        />
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-100/50 p-3 text-sm text-stone-700">
          <input type="checkbox" name="charte" required className="mt-1" />
          <span>
            <strong>Charte spirituelle</strong> : je m&apos;engage à édifier, non à
            détruire ; à parler avec grâce et vérité ; à respecter chaque frère et
            sœur ; à ne rien publier de contraire à l&apos;Évangile. (Éph. 4:29)
          </span>
        </label>
        <button className="rounded-lg bg-amber-600 p-3 font-semibold text-white hover:bg-amber-700">
          Créer mon compte
        </button>
      </form>
      <p className="text-sm text-stone-500">
        Déjà membre ?{" "}
        <Link href="/login" className="font-semibold text-amber-700">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
