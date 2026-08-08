import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSabbathActive } from "@/lib/sabbath";
import { logout } from "@/app/actions";
import { BarreRetour, FloatingPillNav, MotSelah } from "../nav-components";
import { SelecteurLangue } from "../selecteur-langue";
import { Flame, LogOut } from "lucide-react";
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
      <header className="sticky top-2 z-40 mb-6 flex items-center justify-between rounded-full border border-white/20 bg-white/10 px-5 py-3 shadow-2xl backdrop-blur-xl">
        <Link href="/feed" aria-label="Selah" className="flex items-center">
          <MotSelah taille={30} />
        </Link>
        <div className="flex items-center gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 font-medium text-amber-300">
            <Flame className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span>{m.commun.jours(profile?.streak_days ?? 0)}</span>
          </div>
          <span className="hidden font-medium text-white/80 sm:inline">@{profile?.username}</span>
          <SelecteurLangue compact />
          <form action={logout}>
            <button className="flex items-center gap-1 text-white/50 transition hover:text-white">
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
