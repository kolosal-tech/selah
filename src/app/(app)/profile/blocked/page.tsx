import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getMessages } from "@/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { BlockKind } from "@/lib/moderation";
import { UnblockButton } from "./unblock-button";

type BlockedProfile = {
  display_name: string | null;
  username: string;
};

type UserBlock = {
  blocked_id: string;
  created_at: string;
  kind: BlockKind;
  profiles: BlockedProfile | BlockedProfile[] | null;
};

export default async function BlockedAccountsPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rawBlocks }, m, locale] = await Promise.all([
    supabase
      .from("user_blocks")
      // La relation cible est explicite : `user_blocks` possède deux FK vers
      // profiles. La RLS de user_blocks borne d'abord les lignes au propriétaire.
      .select("blocked_id, kind, created_at, profiles!user_blocks_blocked_id_fkey(username, display_name)")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false }),
    getMessages(),
    getLocale(),
  ]);
  const blocks = (rawBlocks ?? []) as UserBlock[];

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link
          href="/profile"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-amber-200 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {m.commun.retour}
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gradient-gold">
          {m.distance.titre}
        </h1>
        <p className="mt-1 text-sm text-white/70">{m.distance.aide}</p>
      </div>

      {blocks.length === 0 ? (
        <p className="glass-card p-5 text-sm text-white/70">{m.distance.vide}</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={m.distance.titre}>
          {blocks.map((block) => {
            const profile = Array.isArray(block.profiles) ? block.profiles[0] : block.profiles;
            const name = profile?.display_name || profile?.username || m.commun.inconnu;
            return (
              <li key={block.blocked_id} className="glass-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">{name}</p>
                  {profile?.username && <p className="mt-0.5 text-sm text-white/60">@{profile.username}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
                    <span className="rounded-full bg-white/10 px-2 py-1 font-semibold text-white/85">
                      {m.distance.gestes[block.kind]}
                    </span>
                    <time dateTime={block.created_at}>
                      {new Date(block.created_at).toLocaleDateString(locale, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </div>
                </div>
                <UnblockButton
                  authorId={block.blocked_id}
                  label={m.distance.annuler}
                  errorMessage={m.distance.annulationErreur}
                />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
