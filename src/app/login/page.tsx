import Link from "next/link";
import { login } from "@/app/actions";
import { Sparkles } from "lucide-react";
import { getMessages } from "@/i18n/server";
import { SelecteurLangue } from "@/app/selecteur-langue";
import { PasswordField } from "@/app/auth/password-field";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;
  const m = await getMessages();
  const identifiantsInvalides = error === "invalid-credentials";
  return (
    <main
      data-load-marker="selah-public-login-v1"
      className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col justify-start gap-6 overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] scroll-py-4 sm:justify-center sm:py-6"
    >
      <div>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
            <Sparkles className="h-4 w-4" />
            <span>Selah</span>
          </p>
          <SelecteurLangue compact />
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          {m.auth.bonRetour}
        </h1>
      </div>
      {identifiantsInvalides && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-sm text-rose-300">
          {m.auth.identifiantsInvalides}
        </p>
      )}
      {identifiantsInvalides && (
        <aside className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          <p>{m.auth.reinitialisationConnexionAide}</p>
          <Link
            href="/forgot-password"
            className="mt-2 inline-flex min-h-11 items-center font-semibold text-amber-300 hover:text-amber-200"
          >
            {m.auth.reinitialiserMotDePasse}
          </Link>
        </aside>
      )}
      {info === "confirm" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3 text-sm text-amber-200">
          {m.auth.confirmeEmail}
        </p>
      )}
      {info === "password-updated" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-3 text-sm text-amber-100">
          {m.auth.motDePasseModifie}
        </p>
      )}
      <form action={login} className="flex flex-col gap-3">
        <label htmlFor="login-email" className="sr-only">
          {m.auth.email}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={m.auth.email}
          className="glass-input rounded-xl p-3 placeholder:text-white/40"
        />
        <PasswordField
          name="password"
          label={m.auth.motDePasse}
          placeholder={m.auth.motDePasse}
          autoComplete="current-password"
        />
        <Link
          href="/forgot-password"
          className="flex min-h-11 items-center self-end text-sm font-semibold text-amber-300 hover:text-amber-200"
        >
          {m.auth.motDePasseOublie}
        </Link>
        <button className="btn-paradise min-h-11 rounded-xl p-3 font-bold transition hover:scale-[1.02]">
          {m.auth.seConnecter}
        </button>
      </form>
      <p className="text-sm text-white/60">
        {m.auth.pasEncoreDeCompte}{" "}
        <Link href="/signup" className="font-semibold text-amber-300 hover:text-amber-200">
          {m.auth.rejoindreReveil}
        </Link>
      </p>
    </main>
  );
}
