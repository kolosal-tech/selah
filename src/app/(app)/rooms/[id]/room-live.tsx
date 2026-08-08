"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useMessages } from "@/i18n/client";

export interface Message {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  auteur: string;
}

type Lien = "connexion" | "direct" | "rafraichissement";

const INTERVALLE_REPLI_MS = 4000;

/**
 * Salle en direct.
 *
 * Deux voies, dans cet ordre :
 *   1. Supabase Realtime (WebSocket). Le socket DOIT porter le jeton de
 *      l'utilisateur : la RLS de `room_messages` est évaluée pour le rôle du
 *      socket, et un socket anonyme ne reçoit jamais rien — silencieusement.
 *      D'où le `realtime.setAuth()` avant l'abonnement.
 *   2. Repli par interrogation toutes les 4 s si le canal n'est pas établi.
 *      Beaucoup de réseaux mobiles et de pare-feu d'entreprise coupent les
 *      WebSockets ; la salle doit rester utilisable, et l'état du lien est
 *      affiché à l'utilisateur plutôt que masqué.
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
  const txt = useMessages();
  const [messages, setMessages] = useState<Message[]>(initial);
  const [texte, setTexte] = useState("");
  const [presents, setPresents] = useState(1);
  const [lien, setLien] = useState<Lien>("connexion");
  const [erreur, setErreur] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  const ajouter = useCallback((entrants: Message[]) => {
    if (entrants.length === 0) return;
    setMessages((prec) => {
      const connus = new Set(prec.map((m) => m.id));
      const nouveaux = entrants.filter((m) => !connus.has(m.id));
      return nouveaux.length ? [...prec, ...nouveaux] : prec;
    });
  }, []);

  const relire = useCallback(async () => {
    const { data } = await supabaseBrowser()
      .from("room_messages")
      .select("id, body, created_at, author_id, profiles!room_messages_author_id_fkey(username)")
      .eq("room_id", roomId)
      .order("created_at")
      .limit(200);
    ajouter(
      (data ?? []).map((m) => {
        const p = m.profiles as unknown as { username: string } | { username: string }[] | null;
        const auteur = Array.isArray(p) ? p[0]?.username : p?.username;
        return {
          id: m.id,
          body: m.body,
          created_at: m.created_at,
          author_id: m.author_id,
          auteur: auteur ?? txt.commun.inconnu,
        };
      }),
    );
  }, [roomId, ajouter, txt]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let repli: ReturnType<typeof setInterval> | null = null;
    let annule = false;

    function demarrerRepli() {
      if (repli) return;
      setLien("rafraichissement");
      repli = setInterval(relire, INTERVALLE_REPLI_MS);
    }

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (annule) return;

      if (!session) {
        demarrerRepli();
        return;
      }
      // Sans ce jeton, le socket est anonyme et la RLS le prive de tout
      // événement, sans erreur visible.
      supabase.realtime.setAuth(session.access_token);

      canal = supabase
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
            ajouter([
              { ...m, auteur: m.author_id === userId ? username : txt.rooms.unFrere },
            ]);
          },
        )
        .on("presence", { event: "sync" }, () => {
          setPresents(Object.keys(canal?.presenceState() ?? {}).length || 1);
        })
        .subscribe(async (statut) => {
          if (annule) return;
          if (statut === "SUBSCRIBED") {
            setLien("direct");
            if (repli) {
              clearInterval(repli);
              repli = null;
            }
            await canal?.track({ at: Date.now() });
            await relire(); // rattrape ce qui est arrivé pendant la connexion
          } else if (statut === "CHANNEL_ERROR" || statut === "TIMED_OUT" || statut === "CLOSED") {
            demarrerRepli();
          }
        });

      // Si le canal n'est pas établi en 5 s, on n'attend pas davantage.
      setTimeout(() => {
        if (!annule) {
          setLien((etat) => {
            if (etat !== "direct") demarrerRepli();
            return etat === "direct" ? etat : "rafraichissement";
          });
        }
      }, 5000);
    })();

    return () => {
      annule = true;
      if (repli) clearInterval(repli);
      if (canal) supabase.removeChannel(canal);
    };
  }, [roomId, userId, username, ajouter, relire, txt]);

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
      setErreur(txt.rooms.messageEchec);
      setTexte(corps);
      return;
    }
    setErreur("");
    await relire();
  }

  const etatLien =
    lien === "direct"
      ? txt.rooms.lienDirect
      : lien === "rafraichissement"
        ? txt.rooms.lienRafraichissement
        : txt.rooms.lienConnexion;

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-3 text-sm text-white/60">
        <span>🕯️ {txt.rooms.presents(presents)}</span>
        <span className={lien === "direct" ? "text-rose-400" : "text-white/40"}>
          {etatLien}
        </span>
      </p>

      <div className="glass-card flex max-h-[55vh] flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-white/45">
            {txt.rooms.salleSilencieuse}
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.author_id === userId
                ? "max-w-[85%] self-end rounded-2xl rounded-br-sm bg-gradient-gold-turquoise px-3 py-2 text-sm font-medium text-slate-950"
                : "max-w-[85%] self-start rounded-2xl rounded-bl-sm border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90"
            }
          >
            {m.author_id !== userId && (
              <span className="block text-xs font-semibold text-amber-300">
                @{m.auteur}
              </span>
            )}
            {m.body}
          </div>
        ))}
        <div ref={finRef} />
      </div>

      {erreur && <p className="text-sm text-rose-300">{erreur}</p>}

      <form onSubmit={envoyer} className="flex gap-2">
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={txt.rooms.messagePlaceholder}
          maxLength={1000}
          className="glass-input flex-1 rounded-xl p-3 text-sm placeholder:text-white/40"
        />
        <button className="btn-paradise rounded-full px-5 transition hover:scale-105">
          {txt.commun.envoyer}
        </button>
      </form>
    </div>
  );
}
