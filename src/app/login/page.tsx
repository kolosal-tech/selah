import Link from "next/link";
import { login } from "@/app/actions";
import { Sparkles } from "lucide-react";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
          <Sparkles className="h-4 w-4" />
          <span>Selah</span>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Bon retour 🙏
        </h1>
      </div>
      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}
      {info === "confirm" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3 text-sm text-amber-200">
          Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis
          connecte-toi.
        </p>
      )}
      <form action={login} className="flex flex-col gap-3">
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
          placeholder="Mot de passe"
          className="glass-input rounded-xl p-3 placeholder:text-white/40"
        />
        <button className="btn-paradise rounded-xl p-3 font-bold transition hover:scale-[1.02]">
          Se connecter
        </button>
      </form>
      <p className="text-sm text-white/60">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="font-semibold text-amber-300 hover:text-amber-200">
          Rejoindre le Réveil
        </Link>
      </p>
    </main>
  );
}
