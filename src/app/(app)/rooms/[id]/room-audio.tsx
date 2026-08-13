"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Mic, MicOff, ShieldCheck } from "lucide-react";
import { useMessages } from "@/i18n/client";
import { supabaseBrowser } from "@/lib/supabase/client";
import { muteAllRoomAudio, recordRoomJoined } from "../audio-actions";

type AudioState = "idle" | "connecting" | "listening" | "full" | "error" | "closed";
type SignalKind = "offer" | "answer" | "ice";

interface ParticipantRow {
  user_id: string;
  microphone_enabled: boolean;
}

interface SignalRow {
  id: string;
  room_id: string;
  sender_id: string;
  recipient_id: string;
  kind: SignalKind;
  payload: Record<string, unknown>;
}

interface PeerState {
  connection: RTCPeerConnection;
  pendingIce: RTCIceCandidateInit[];
  offerSent: boolean;
}

function RemoteAudio({
  stream,
  onPlaybackBlocked,
}: {
  stream: MediaStream;
  onPlaybackBlocked: () => void;
}) {
  const elementRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (element) {
      element.srcObject = stream;
      void element.play().catch(onPlaybackBlocked);
    }
    return () => {
      if (element) element.srcObject = null;
    };
  }, [onPlaybackBlocked, stream]);

  return <audio ref={elementRef} autoPlay />;
}

/**
 * Pilote audio maillé P2P (quatre personnes au maximum).
 *
 * La signalisation seule passe par Supabase. Aucun média n'est relayé et
 * aucun serveur TURN/SFU n'est configuré : certains NAT ou réseaux filtrés
 * ne pourront donc pas établir la liaison directe.
 */
export function RoomAudio({
  roomId,
  userId,
  closed,
  canModerate,
}: {
  roomId: string;
  userId: string;
  closed: boolean;
  canModerate: boolean;
}) {
  const txt = useMessages();
  const supabaseRef = useRef<ReturnType<typeof supabaseBrowser> | null>(null);
  const peersRef = useRef(new Map<string, PeerState>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const joinedRef = useRef(false);
  const mountedRef = useRef(true);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const [joinRequested, setJoinRequested] = useState(false);
  const [state, setState] = useState<AudioState>("idle");
  const [participants, setParticipants] = useState(0);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [feedback, setFeedback] = useState("");

  const stopMicrophone = useCallback(
    async (persist = true) => {
      const stream = localStreamRef.current;
      localStreamRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      for (const { connection } of peersRef.current.values()) {
        const sender = connection.getSenders().find((item) => item.track?.kind === "audio");
        if (sender) void sender.replaceTrack(null);
      }
      if (mountedRef.current) setMicrophoneEnabled(false);

      if (persist && joinedRef.current && supabaseRef.current) {
        await supabaseRef.current
          .from("room_audio_participants")
          .update({ microphone_enabled: false, last_seen_at: new Date().toISOString() })
          .eq("room_id", roomId)
          .eq("user_id", userId);
      }
    },
    [roomId, userId],
  );

  useEffect(() => {
    mountedRef.current = true;
    if (closed || !joinRequested) {
      return () => {
        mountedRef.current = false;
      };
    }

    const supabase = supabaseBrowser();
    const peers = peersRef.current;
    supabaseRef.current = supabase;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const sendSignal = async (
      recipientId: string,
      kind: SignalKind,
      payload: Record<string, unknown>,
    ) => {
      const { error } = await supabase.from("room_audio_signals").insert({
        room_id: roomId,
        sender_id: userId,
        recipient_id: recipientId,
        kind,
        payload,
      });
      if (error && !cancelled) {
        setFeedback(txt.rooms.audioErreur);
      }
    };

    const closePeer = (peerId: string) => {
      peersRef.current.get(peerId)?.connection.close();
      peersRef.current.delete(peerId);
      setRemoteStreams((current) => {
        const next = { ...current };
        delete next[peerId];
        return next;
      });
    };

    const ensurePeer = (peerId: string) => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      // Pas de serveur ICE externe : le pilote reste réellement P2P.
      const connection = new RTCPeerConnection({ iceServers: [] });
      const transceiver = connection.addTransceiver("audio", { direction: "sendrecv" });
      const localTrack = localStreamRef.current?.getAudioTracks()[0];
      if (localTrack) void transceiver.sender.replaceTrack(localTrack);

      const peer: PeerState = { connection, pendingIce: [], offerSent: false };
      peersRef.current.set(peerId, peer);

      connection.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal(peerId, "ice", event.candidate.toJSON() as Record<string, unknown>);
        }
      };
      connection.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStreams((current) => ({ ...current, [peerId]: stream }));
      };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "failed" && !cancelled) {
          setFeedback(txt.rooms.p2pLimite);
        }
      };

      return peer;
    };

    const offerIfInitiator = async (peerId: string) => {
      // Comparaison d'octets, jamais `localeCompare` : la collation dépend de
      // la table ICU du moteur. Deux pairs sur des navigateurs différents
      // pourraient se croire tous deux initiateurs — ou aucun — et la salle
      // resterait muette sans erreur visible.
      if (userId >= peerId) return;
      const peer = ensurePeer(peerId);
      if (peer.offerSent || peer.connection.signalingState !== "stable") return;
      peer.offerSent = true;
      try {
        const offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);
        await sendSignal(peerId, "offer", { type: offer.type, sdp: offer.sdp });
      } catch {
        peer.offerSent = false;
        if (!cancelled) setFeedback(txt.rooms.audioErreur);
      }
    };

    const refreshParticipants = async () => {
      const { data, error } = await supabase
        .from("room_audio_participants")
        .select("user_id, microphone_enabled")
        .eq("room_id", roomId)
        .order("joined_at", { ascending: true });
      if (cancelled || error) return;

      const rows = (data ?? []) as ParticipantRow[];
      setParticipants(rows.length);
      const activePeers = new Set(rows.map((row) => row.user_id).filter((id) => id !== userId));
      for (const peerId of peersRef.current.keys()) {
        if (!activePeers.has(peerId)) closePeer(peerId);
      }
      for (const peerId of activePeers) {
        ensurePeer(peerId);
        void offerIfInitiator(peerId);
      }

      const me = rows.find((row) => row.user_id === userId);
      if (!me && joinedRef.current) {
        joinedRef.current = false;
        await stopMicrophone(false);
        for (const peerId of [...peersRef.current.keys()]) closePeer(peerId);
        if (!cancelled) {
          setState("closed");
          setFeedback(txt.rooms.audioFerme);
        }
        return;
      }
      if (me && !me.microphone_enabled && localStreamRef.current) {
        await stopMicrophone(false);
        if (!cancelled) setFeedback(txt.rooms.toutCoupe);
      }
    };

    const processSignal = async (signal: SignalRow) => {
      if (signal.room_id !== roomId || signal.recipient_id !== userId) return;
      const peer = ensurePeer(signal.sender_id);
      try {
        if (signal.kind === "offer") {
          if (peer.connection.signalingState === "have-local-offer") {
            await peer.connection.setLocalDescription({ type: "rollback" });
          }
          await peer.connection.setRemoteDescription(
            signal.payload as unknown as RTCSessionDescriptionInit,
          );
          for (const candidate of peer.pendingIce.splice(0)) {
            await peer.connection.addIceCandidate(candidate);
          }
          const answer = await peer.connection.createAnswer();
          await peer.connection.setLocalDescription(answer);
          await sendSignal(
            signal.sender_id,
            "answer",
            { type: answer.type, sdp: answer.sdp },
          );
        } else if (signal.kind === "answer") {
          if (peer.connection.signalingState === "have-local-offer") {
            await peer.connection.setRemoteDescription(
              signal.payload as unknown as RTCSessionDescriptionInit,
            );
            for (const candidate of peer.pendingIce.splice(0)) {
              await peer.connection.addIceCandidate(candidate);
            }
          }
        } else {
          const candidate = signal.payload as RTCIceCandidateInit;
          if (peer.connection.remoteDescription) {
            await peer.connection.addIceCandidate(candidate);
          } else {
            peer.pendingIce.push(candidate);
          }
        }
      } catch {
        if (!cancelled) setFeedback(txt.rooms.audioErreur);
      } finally {
        await supabase.from("room_audio_signals").delete().eq("id", signal.id);
      }
    };

    const join = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) {
        if (!cancelled) setState("error");
        return;
      }
      supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`room-audio:${roomId}:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "room_audio_participants",
            filter: `room_id=eq.${roomId}`,
          },
          () => void refreshParticipants(),
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "room_audio_signals",
            filter: `recipient_id=eq.${userId}`,
          },
          (event) => void processSignal(event.new as SignalRow),
        )
        .subscribe(async (status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED" && !joinedRef.current) {
            const { error } = await supabase.from("room_audio_participants").upsert(
              {
                room_id: roomId,
                user_id: userId,
                microphone_enabled: false,
                last_seen_at: new Date().toISOString(),
              },
              { onConflict: "room_id,user_id" },
            );
            if (error) {
              setState(error.code === "23514" || error.code === "P0001" ? "full" : "error");
              setJoinRequested(false);
              return;
            }
            joinedRef.current = true;
            setState("listening");
            // La ligne de participation est écrite : l'entrée est acquise, pas
            // seulement demandée. La mesure ne bloque pas la suite.
            void recordRoomJoined();
            await refreshParticipants();

            const { data: pending } = await supabase
              .from("room_audio_signals")
              .select("id, room_id, sender_id, recipient_id, kind, payload")
              .eq("room_id", roomId)
              .eq("recipient_id", userId)
              .order("created_at", { ascending: true });
            for (const signal of (pending ?? []) as SignalRow[]) {
              await processSignal(signal);
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setState("error");
          }
        });

      heartbeat = setInterval(() => {
        if (!joinedRef.current) return;
        void supabase
          .from("room_audio_participants")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("room_id", roomId)
          .eq("user_id", userId);
      }, 20_000);
    };

    void join();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (heartbeat) clearInterval(heartbeat);
      void stopMicrophone(false);
      for (const peerId of [...peers.keys()]) closePeer(peerId);
      if (joinedRef.current) {
        void supabase
          .from("room_audio_participants")
          .delete()
          .eq("room_id", roomId)
          .eq("user_id", userId);
      }
      joinedRef.current = false;
      if (channel) void supabase.removeChannel(channel);
      supabaseRef.current = null;
    };
  }, [closed, joinRequested, roomId, stopMicrophone, txt, userId]);

  const markPlaybackBlocked = useCallback(() => {
    setPlaybackBlocked(true);
  }, []);

  async function resumePlayback() {
    const elements = audioContainerRef.current?.querySelectorAll("audio") ?? [];
    const results = await Promise.allSettled([...elements].map((element) => element.play()));
    setPlaybackBlocked(results.some((result) => result.status === "rejected"));
  }

  function requestJoin() {
    setFeedback("");
    setPlaybackBlocked(false);
    setState("connecting");
    setJoinRequested(true);
  }

  function leaveAudio() {
    void stopMicrophone();
    setFeedback("");
    setPlaybackBlocked(false);
    setState("idle");
    setJoinRequested(false);
  }

  async function enableMicrophone() {
    setFeedback("");
    if (!joinedRef.current || !navigator.mediaDevices?.getUserMedia) {
      setFeedback(txt.rooms.audioIndisponible);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const track = stream.getAudioTracks()[0];
      if (!track) throw new Error("missing audio track");
      localStreamRef.current = stream;
      for (const { connection } of peersRef.current.values()) {
        const sender = connection.getSenders().find((item) => item.track?.kind === "audio")
          ?? connection.getTransceivers().find((item) => item.receiver.track.kind === "audio")?.sender;
        if (sender) await sender.replaceTrack(track);
      }

      const supabase = supabaseRef.current;
      if (!supabase) throw new Error("audio client unavailable");
      const { error } = await supabase
        .from("room_audio_participants")
        .update({ microphone_enabled: true, last_seen_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", userId);
      if (error) throw error;
      setMicrophoneEnabled(true);
      setFeedback(txt.rooms.microActif);
    } catch {
      await stopMicrophone(false);
      setFeedback(txt.rooms.audioIndisponible);
    }
  }

  async function muteEveryone() {
    const result = await muteAllRoomAudio(roomId);
    setFeedback(result.ok ? txt.rooms.toutCoupe : txt.rooms.audioModerationRefusee);
  }

  if (closed) {
    return (
      <section className="glass-card flex items-center gap-3 p-4 text-sm text-white/60">
        <Headphones className="h-5 w-5" />
        <span>{txt.rooms.audioFerme}</span>
      </section>
    );
  }

  const statusLabel =
    state === "idle"
      ? txt.rooms.audioPilote
      : state === "connecting"
      ? txt.rooms.audioConnexion
      : state === "full"
        ? txt.rooms.audioPlein
        : state === "closed"
          ? txt.rooms.audioFerme
          : state === "error"
            ? txt.rooms.audioErreur
            : txt.rooms.audioEcoute;

  return (
    <section className="glass-card space-y-3 p-4" aria-label={txt.rooms.audioTitre}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Headphones className="h-5 w-5 text-teal-300" />
            {txt.rooms.audioTitre}
          </h2>
          <p className="mt-1 text-xs text-white/55">
            {statusLabel} · {txt.rooms.participantsAudio(participants)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!joinRequested && (
            <button
              type="button"
              onClick={requestJoin}
              className="flex items-center gap-2 rounded-full border border-teal-300/30 bg-teal-400/10 px-4 py-2 text-xs font-semibold text-teal-100 hover:bg-teal-400/20"
            >
              <Headphones className="h-4 w-4" />
              {txt.rooms.audioRejoindre}
            </button>
          )}
          {state === "listening" && (
            <button
              type="button"
              onClick={() => void (microphoneEnabled ? stopMicrophone() : enableMicrophone())}
              aria-pressed={microphoneEnabled}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                microphoneEnabled
                  ? "border-rose-400/50 bg-rose-500/20 text-rose-200"
                  : "border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              {microphoneEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {microphoneEnabled ? txt.rooms.microCouper : txt.rooms.microActiver}
            </button>
          )}
          {canModerate && state === "listening" && (
            <button
              type="button"
              onClick={() => void muteEveryone()}
              className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
            >
              <ShieldCheck className="h-4 w-4" />
              {txt.rooms.toutCouper}
            </button>
          )}
          {joinRequested && (
            <button
              type="button"
              onClick={leaveAudio}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/10"
            >
              {txt.rooms.audioQuitter}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-white/45">{txt.rooms.p2pLimite}</p>
      {playbackBlocked && (
        <button
          type="button"
          onClick={() => void resumePlayback()}
          className="text-xs font-semibold text-teal-200 underline underline-offset-4"
        >
          {txt.rooms.audioRejoindre}
        </button>
      )}
      {feedback && <p className="text-xs text-amber-200" role="status">{feedback}</p>}
      <div ref={audioContainerRef} className="hidden" aria-hidden="true">
        {Object.entries(remoteStreams).map(([peerId, stream]) => (
          <RemoteAudio
            key={peerId}
            stream={stream}
            onPlaybackBlocked={markPlaybackBlocked}
          />
        ))}
      </div>
    </section>
  );
}
