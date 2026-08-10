import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSabbathActive } from "@/lib/sabbath";
import { logout } from "@/app/actions";
import { BarreRetour, FloatingPillNav, MotSelah } from "../nav-components";
import { SelecteurLangue } from "../selecteur-langue";
import { Flame, LogOut, UserCircle } from "lucide-react";
import { getMessages } from "@/i18n/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, streak_days, sabbath_until")
    .eq("id", user.id)
    .single();

  if (isSabbathActive(profile?.sabbath_until)) redirect("/sabbath");

  const m = await getMessages();

  return (
    <div className="mx-auto flex min-h-screen max-w-[430px] flex-col px-4 pb-36 pt-4">
      {/* Header : logotype Selah bien visible, blanc et italique */}
      <header className="sticky top-2 z-40 mb-6 flex items-center justify-between rounded-full border border-white/20 bg-white/10 px-3 py-2 shadow-2xl backdrop-blur-xl sm:px-5 sm:py-3">
        <Link href="/feed" aria-label="Selah" className="flex items-center">
          <MotSelah taille={28} />
        </Link>
        <div className="flex min-w-0 items-center gap-1 text-xs sm:gap-3 sm:text-sm">
          <div className="flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/20 px-2 font-medium text-amber-300 sm:px-3">
            <Flame className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span>{m.commun.jours(profile?.streak_days ?? 0)}</span>
          </div>
          <Link
            href="/profile"
            aria-label={m.commun.profil}
            className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 font-medium text-white/85 transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <UserCircle className="h-4 w-4" aria-hidden="true" />
            <span className="hidden max-w-20 truncate text-[10px] sm:inline sm:text-sm">{profile?.username ? `@${profile.username}` : m.commun.profil}</span>
          </Link>
          <SelecteurLangue compact />
          <form action={logout}>
            <button className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">{m.commun.sortir}</span>
            </button>
          </form>
        </div>
      </header>

      {/* Retour contextuel : uniquement hors des cinq onglets principaux */}
      <BarreRetour />

      {/* Navigation flottante + chips */}
      <FloatingPillNav />

      {/* Contenu — entrée en fondu montant à chaque navigation */}
      <div className="flex-1 animate-arrive">{children}</div>
    </div>
  );
}
