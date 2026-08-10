import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/i18n/messages";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath: string) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

describe("pilote audio des Upper Rooms", () => {
  it("n'initialise aucun effet audio avant un geste explicite", async () => {
    const audio = await source("src/app/(app)/rooms/[id]/room-audio.tsx");
    const effectStart = audio.indexOf("useEffect(() => {", audio.indexOf("const stopMicrophone"));
    const joinGuard = audio.indexOf("if (closed || !joinRequested)", effectStart);
    const clientStart = audio.indexOf("const supabase = supabaseBrowser()", effectStart);
    const enableIndex = audio.indexOf("async function enableMicrophone()");

    expect(audio).toContain("const [joinRequested, setJoinRequested] = useState(false)");
    expect(effectStart).toBeGreaterThan(-1);
    expect(joinGuard).toBeGreaterThan(effectStart);
    expect(clientStart).toBeGreaterThan(joinGuard);
    expect(audio.slice(effectStart, joinGuard)).not.toContain(".upsert(");
    expect(audio.slice(effectStart, joinGuard)).not.toContain(".channel(");
    expect(audio.slice(effectStart, joinGuard)).not.toContain("getUserMedia");
    expect(audio).toContain("onClick={requestJoin}");
    expect(audio).toContain("setJoinRequested(true)");
    expect(enableIndex).toBeGreaterThan(-1);
    expect(audio.slice(0, enableIndex)).not.toContain("getUserMedia");
  });

  it("demande le micro seulement après activation et nettoie la session à la sortie", async () => {
    const audio = await source("src/app/(app)/rooms/[id]/room-audio.tsx");

    expect(audio).toContain("navigator.mediaDevices.getUserMedia");
    expect(audio).toContain("stream?.getTracks().forEach((track) => track.stop())");
    expect(audio).toContain("supabase.removeChannel(channel)");
    expect(audio).toContain('.from("room_audio_participants")\n          .delete()');
    expect(audio).toContain("setJoinRequested(false)");
  });

  it("affiche la fermeture réelle et n'invente pas de compteur de démonstration", async () => {
    const audio = await source("src/app/(app)/rooms/[id]/room-audio.tsx");
    const rooms = await source("src/app/(app)/rooms/page.tsx");

    expect(audio).toContain("if (closed) {");
    expect(audio).toContain("txt.rooms.audioFerme");
    expect(rooms).not.toContain("12 + idx * 7");
    expect(rooms).not.toContain("m.rooms.auditeurs(");
    expect(rooms).toContain("m.rooms.audioPilote");
  });

  it("reste un pilote P2P sans configuration TURN ou SFU côté client", async () => {
    const audio = await source("src/app/(app)/rooms/[id]/room-audio.tsx");

    expect(audio).toContain("new RTCPeerConnection({ iceServers: [] })");
    expect(audio).not.toMatch(/iceServers\s*:\s*\[[^\]]*(?:turn:|turns:|sfu)/i);
  });
});

describe("migration audio des Upper Rooms", () => {
  it("applique les limites, la fermeture, RLS et les droits attendus", async () => {
    const migration = await source(
      "supabase/migrations/20260810221136_media_profile_room_audio.sql",
    );

    expect(migration).toContain("microphone_enabled boolean not null default false");
    expect(migration).toContain("if participant_count >= 4 then");
    expect(migration).toContain("where id = new.room_id\n    and closed_at is null");
    expect(migration).toContain("delete from public.room_audio_participants where room_id = new.id");
    expect(migration).toContain(
      "references public.room_audio_participants (room_id, user_id) on delete cascade",
    );

    for (const table of ["room_audio_participants", "room_audio_signals"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`revoke all on public.${table} from anon, authenticated`);
      expect(migration).toContain(`grant select, insert, delete on public.${table} to authenticated`);
    }
  });

  it("centralise le mute en SECURITY INVOKER et rend Realtime idempotent pour les deux tables", async () => {
    const migration = await source(
      "supabase/migrations/20260810221136_media_profile_room_audio.sql",
    );
    const rpcStart = migration.indexOf("create or replace function public.mute_all_room_audio");
    const realtimeStart = migration.indexOf("do $$");

    expect(rpcStart).toBeGreaterThan(-1);
    expect(migration.slice(rpcStart, realtimeStart)).toContain("security invoker");
    expect(migration.slice(rpcStart, realtimeStart)).toContain("update public.room_audio_participants");
    expect(realtimeStart).toBeGreaterThan(-1);
    for (const table of ["room_audio_participants", "room_audio_signals"]) {
      expect(migration.slice(realtimeStart)).toContain(`tablename = '${table}'`);
      expect(migration.slice(realtimeStart)).toContain(
        `alter publication supabase_realtime add table public.${table}`,
      );
    }
  });
});

describe("messages audio", () => {
  it("fournit tous les libellés aux douze langues", () => {
    const keys = [
      "audioTitre",
      "audioPilote",
      "audioEcoute",
      "audioConnexion",
      "audioPlein",
      "audioErreur",
      "audioIndisponible",
      "audioRejoindre",
      "audioQuitter",
      "microActif",
      "microActiver",
      "microCouper",
      "toutCouper",
      "toutCoupe",
      "audioModerationRefusee",
      "p2pLimite",
      "audioFerme",
    ] as const;

    expect(Object.keys(MESSAGES)).toHaveLength(12);
    for (const [locale, messages] of Object.entries(MESSAGES)) {
      for (const key of keys) {
        expect(messages.rooms[key], `${locale}.${key}`).toBeTypeOf("string");
        expect(messages.rooms[key].trim(), `${locale}.${key}`).not.toBe("");
      }
      expect(messages.rooms.participantsAudio, `${locale}.participantsAudio`).toBeTypeOf("function");
      expect(messages.rooms.participantsAudio(4).trim(), `${locale}.participantsAudio(4)`).not.toBe("");
      expect(messages.rooms.p2pLimite, `${locale}.p2pLimite`).toMatch(/P2P/i);
      expect(messages.rooms.p2pLimite, `${locale}.p2pLimite`).toMatch(/4/);
      expect(messages.rooms.p2pLimite, `${locale}.p2pLimite`).toMatch(/TURN/i);
      expect(messages.rooms.p2pLimite, `${locale}.p2pLimite`).toMatch(/SFU/i);
    }
  });
});
