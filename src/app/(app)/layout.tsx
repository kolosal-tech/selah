import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSabbathActive } from "@/lib/sabbath";
import { logout } from "@/app/actions";

const NAV = [
  ["/feed", "Fil"],
  ["/prayer", "Prière"],
  ["/map", "Carte"],
  ["/mentorship", "Mentorat"],
  ["/churches", "Églises"],
] as const;

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
    <div className="mx-auto max-w-2xl px-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between border-b border-amber-200 bg-amber-50/90 px-4 py-3 backdrop-blur">
        <Link href="/feed" className="text-xl font-bold text-amber-700">
          Selah
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span title="Streak spirituel">🔥 {profile?.streak_days ?? 0} j</span>
          <span className="text-stone-500">@{profile?.username}</span>
          <form action={logout}>
            <button className="text-stone-400 hover:text-stone-600">Sortir</button>
          </form>
        </div>
      </header>
      {children}
      <nav className="fixed inset-x-0 bottom-0 border-t border-amber-200 bg-white">
        <div className="mx-auto flex max-w-2xl justify-around py-2 text-sm">
          {NAV.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-1 text-stone-600 hover:bg-amber-100 hover:text-amber-800"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/sabbath"
            className="rounded px-3 py-1 text-stone-600 hover:bg-amber-100"
            title="Mode Sabbat"
          >
            🕊️
          </Link>
        </div>
      </nav>
    </div>
  );
}
