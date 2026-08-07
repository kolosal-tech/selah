import Link from "next/link";
import { login } from "@/app/actions";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-bold text-stone-900">Bon retour 🙏</h1>
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <form action={login} className="flex flex-col gap-3">
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
          placeholder="Mot de passe"
          className="rounded-lg border border-stone-300 bg-white p-3"
        />
        <button className="rounded-lg bg-amber-600 p-3 font-semibold text-white hover:bg-amber-700">
          Se connecter
        </button>
      </form>
      <p className="text-sm text-stone-500">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="font-semibold text-amber-700">
          Rejoindre le Réveil
        </Link>
      </p>
    </main>
  );
}
