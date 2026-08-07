"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export interface Message {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  auteur: string;
}

/**
 * Salle en direct : les messages arrivent par Supabase Realtime, l'envoi passe
 * par le client Supabase (soumis aux mêmes policies RLS que le serveur). Pas de
 * Server Action ici — recharger la page à chaque message casserait le direct.
 */
export function RoomLive({
  roomId,
  userId,
  username,
  initial,
}: {
  roomId: string;
  userId: string;
  username: string;
  initial: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [texte, setTexte] = useState("");
  const [presents, setPresents] = useState(1);
  const [erreur, setErreur] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const canal = supabase
      .channel(`room:${roomId}`, { config: { presence: { key: userId } } })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (charge) => {
          const m = charge.new as Omit<Message, "auteur">;
          setMessages((prec) =>
            prec.some((x) => x.id === m.id)
              ? prec
              : [...prec, { ...m, auteur: m.author_id === userId ? username : "un frère" }],
          );
        },
      )
      .on("presence", { event: "sync" }, () => {
        setPresents(Object.keys(canal.presenceState()).length || 1);
      })
      .subscribe(async (statut) => {
        if (statut === "SUBSCRIBED") await canal.track({ at: Date.now() });
      });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [roomId, userId, username]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const corps = texte.trim();
    if (!corps) return;
    setTexte("");
    const { error } = await supabaseBrowser()
      .from("room_messages")
      .insert({ room_id: roomId, author_id: userId, body: corps.slice(0, 1000) });
    if (error) {
      setErreur("Message non envoyé. Réessaie.");
      setTexte(corps);
      return;
    }
    setErreur("");
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-stone-500">
        🕯️ {presents} {presents > 1 ? "personnes présentes" : "personne présente"}
      </p>

      <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto rounded-2xl border border-amber-100 bg-white p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-stone-400">
            La salle est silencieuse. Ouvre la prière.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.author_id === userId
                ? "self-end rounded-2xl rounded-br-sm bg-amber-600 px-3 py-2 text-sm text-white"
                : "self-start rounded-2xl rounded-bl-sm bg-amber-50 px-3 py-2 text-sm text-stone-800"
            }
          >
            {m.author_id !== userId && (
              <span className="block text-xs font-semibold text-amber-700">
                @{m.auteur}
              </span>
            )}
            {m.body}
          </div>
        ))}
        <div ref={finRef} />
      </div>

      {erreur && <p className="text-sm text-red-700">{erreur}</p>}

      <form onSubmit={envoyer} className="flex gap-2">
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Prie, exhorte, cite un verset…"
          maxLength={1000}
          className="flex-1 rounded-lg border border-stone-200 p-3 text-sm"
        />
        <button className="rounded-full bg-amber-600 px-5 font-semibold text-white hover:bg-amber-700">
          Envoyer
        </button>
      </form>
    </div>
  );
}
