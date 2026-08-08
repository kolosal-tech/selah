import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSabbathActive } from "@/lib/sabbath";
import { logout } from "@/app/actions";
import { FloatingPillNav } from "../nav-components";
import { AmbianceSonore } from "../ambiance-sonore";
import { Flame, LogOut, Sparkles } from "lucide-react";

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

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-36 min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-2 z-40 mb-6 flex items-center justify-between rounded-full bg-white/10 backdrop-blur-xl border border-white/20 px-5 py-3 shadow-2xl">
        <Link href="/feed" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
          <span className="text-gradient-gold">Selah</span>
        </Link>
        <div className="flex items-center gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 border border-amber-500/30 text-amber-300 font-medium">
            <Flame className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span>{profile?.streak_days ?? 0} j</span>
          </div>
          <span className="text-white/80 font-medium hidden sm:inline">@{profile?.username}</span>
          <AmbianceSonore />
          <form action={logout}>
            <button className="flex items-center gap-1 text-white/50 hover:text-white transition">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sortir</span>
            </button>
          </form>
        </div>
      </header>

      {/* Floating Navigation & Chip Subnav */}
      <FloatingPillNav />

      {/* Main Content — entrée en fondu montant à chaque navigation */}
      <div className="flex-1 animate-arrive">
        {children}
      </div>
    </div>
  );
}

