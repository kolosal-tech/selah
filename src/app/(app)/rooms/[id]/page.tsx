import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { closePrayerRoom } from "@/app/actions";
import { RoomLive, type Message } from "./room-live";

export default async function Room({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: room }, { data: messages }, { data: moi }] = await Promise.all([
    supabase
      .from("prayer_rooms")
      .select("*, profiles!prayer_rooms_host_id_fkey(username)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("room_messages")
      .select("id, body, created_at, author_id, profiles!room_messages_author_id_fkey(username)")
      .eq("room_id", id)
      .order("created_at")
      .limit(200),
    supabase.from("profiles").select("username").eq("id", user.id).single(),
  ]);

  if (!room) notFound();

  // PostgREST renvoie l'embed sous forme de tableau quand il ne peut pas
  // prouver l'unicité ; on prend le premier élément dans ce cas.
  const initial: Message[] = (messages ?? []).map((m) => {
    const p = m.profiles as unknown as
      | { username: string }
      | { username: string }[]
      | null;
    const auteur = Array.isArray(p) ? p[0]?.username : p?.username;
    return {
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      author_id: m.author_id,
      auteur: auteur ?? "inconnu",
    };
  });

  return (
    <main className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/rooms" className="text-sm text-white/50 hover:text-white/80">
            ← Upper Room
          </Link>
          <h1 className="text-2xl font-bold text-gradient-gold">{room.title}</h1>
          <p className="text-white/70">
            {room.topic || "Prière libre"} · animée par @{room.profiles?.username}
          </p>
        </div>
        {room.host_id === user.id && !room.closed_at && (
          <form action={closePrayerRoom.bind(null, room.id)}>
            <button className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">
              Fermer
            </button>
          </form>
        )}
      </div>

      {room.closed_at ? (
        <p className="glass-card p-6 text-center text-white/60">
          Cette veillée est terminée. Les messages restent lisibles.
        </p>
      ) : null}

      <RoomLive
        roomId={room.id}
        userId={user.id}
        username={moi?.username ?? "moi"}
        initial={initial}
      />
    </main>
  );
}
