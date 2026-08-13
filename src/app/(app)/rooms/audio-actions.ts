"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { recordProductEventAfter } from "@/lib/analytics/record";

export type RoomAudioActionResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "unavailable" };

/**
 * Coupe les micros déclarés actifs dans une salle.
 *
 * L'autorisation reste appliquée par la RPC PostgreSQL SECURITY INVOKER :
 * cette action ne remplace pas la RLS et ne détient aucun secret privilégié.
 */
export async function muteAllRoomAudio(roomId: string): Promise<RoomAudioActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const { data, error } = await supabase.rpc("mute_all_room_audio", {
    p_room_id: roomId,
  });

  if (error) {
    return {
      ok: false,
      reason: error.code === "42501" ? "forbidden" : "unavailable",
    };
  }

  if (typeof data !== "number") return { ok: false, reason: "unavailable" };
  revalidatePath(`/rooms/${roomId}`);
  return { ok: true };
}

/**
 * Enregistre l'entrée volontaire dans l'audio d'une salle.
 *
 * `room_opened` ne mesurait que le rendu de la page : impossible de distinguer
 * un visiteur qui lit les messages d'un participant vocal réel. L'acteur est
 * attribué en base par `auth.uid()`, jamais par un paramètre, et l'appel est
 * silencieux — une mesure ne casse pas une entrée en salle.
 */
export async function recordRoomJoined(): Promise<void> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  recordProductEventAfter(supabase, { name: "room_joined", surface: "room_create" });
}
