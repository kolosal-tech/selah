"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

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
