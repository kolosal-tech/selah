import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AUTH_THROTTLE_SCOPES } from "@/lib/auth-throttle";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relatif: string) {
  return readFile(path.join(racine, relatif), "utf8");
}

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const MIGRATION = "supabase/migrations/20260814100000_auth_throttle_et_room_joined.sql";

describe("frein d'entrée sur les parcours non authentifiés", () => {
  it("couvre les trois portées d'entrée, et rien d'autre", async () => {
    const migration = await source(MIGRATION);
    expect([...AUTH_THROTTLE_SCOPES]).toEqual(["login", "signup", "password_reset"]);
    // La contrainte SQL est la liste fermée : une portée ajoutée d'un seul côté
    // serait refusée en base, pas au typage.
    expect(migration).toContain(
      "check (scope in ('login', 'signup', 'password_reset'))",
    );
  });

  it("ne transmet jamais l'adresse à la base", async () => {
    const throttle = sansCommentaires(await source("src/lib/auth-throttle.ts"));
    const migration = await source(MIGRATION);
    // Seul le condensé circule ; la colonne n'accepte qu'un SHA-256 hexadécimal.
    expect(throttle).toContain("createHash(\"sha256\")");
    expect(throttle).not.toMatch(/p_ip:|p_adresse|ip:\s*adresse/);
    expect(migration).toContain("ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$')");
    expect(migration).not.toMatch(/\bip\s+inet\b|ip_address|user_agent/);
  });

  it("poivre le condensé plutôt que de hacher l'adresse nue", async () => {
    const throttle = await source("src/lib/auth-throttle.ts");
    // Sans poivre, l'espace IPv4 s'épuise en force brute : un SHA-256 nu ne
    // protégerait rien de ce que cette table est censée ne pas savoir.
    expect(throttle).toContain("`${adresse}:${poivre}`");
    expect(throttle).toContain("process.env.SELAH_ANALYTICS_TOKEN");
  });

  it("laisse passer plutôt que de bloquer l'authentification en cas de panne", async () => {
    const throttle = await source("src/lib/auth-throttle.ts");
    // Un anti-abus qui ferme l'entrée pendant un incident transforme une gêne
    // en indisponibilité totale.
    expect(throttle).toMatch(/if \(!poivre\) return true;/);
    expect(throttle).toMatch(/if \(!adresse\) return true;/);
    expect(throttle).toMatch(/if \(error\) return true;/);
    expect(throttle).toMatch(/catch \{\s*return true;/);
  });

  it("garde la fonction élevée hors du schéma exposé", async () => {
    const migration = await source(MIGRATION);
    // Même motif que consume_rate_limit : wrapper INVOKER, élévation privée.
    expect(migration).toContain("create table private.auth_throttle");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on private.auth_throttle from public, anon, authenticated",
    );
  });

  it("freine les trois entrées avant l'appel au fournisseur", async () => {
    const actions = await source("src/app/actions.ts");
    const passwords = await source("src/app/auth/password-actions.ts");
    // L'ordre compte : freiner après l'appel ne protégerait aucun quota.
    const login = /export async function login[\s\S]*?\n}/.exec(actions)![0];
    expect(login.indexOf('consumeAuthAttempt(supabase, "login")')).toBeLessThan(
      login.indexOf("signInWithPassword"),
    );
    const signup = /export async function signup[\s\S]*?\n}/.exec(actions)![0];
    expect(signup.indexOf('consumeAuthAttempt(supabase, "signup")')).toBeLessThan(
      signup.indexOf("auth.signUp"),
    );
    expect(passwords.indexOf('consumeAuthAttempt(supabase, "password_reset")')).toBeLessThan(
      passwords.indexOf("resetPasswordForEmail"),
    );
  });

  it("ne révèle pas si le compte existe quand il refuse", async () => {
    const actions = await source("src/app/actions.ts");
    const passwords = await source("src/app/auth/password-actions.ts");
    // Le même code d'erreur pour tout le monde : un refus ne doit pas devenir
    // un oracle d'existence de compte.
    expect(actions).toContain("/login?error=trop-de-tentatives");
    expect(actions).toContain("/signup?error=trop-de-tentatives");
    expect(passwords).toContain("/forgot-password?error=trop-de-tentatives");
  });
});

describe("mesure de l'entrée en salle audio", () => {
  it("distingue l'ouverture de la page et l'entrée dans l'audio", async () => {
    const migration = await source(MIGRATION);
    const evenements = await source("src/lib/analytics/events.ts");
    const audio = await source("src/app/(app)/rooms/[id]/room-audio.tsx");

    expect(migration).toContain("add value if not exists 'room_joined'");
    expect(evenements).toContain('"room_joined"');
    // L'émission suit l'écriture de la ligne de participation : mesurer
    // l'intention plutôt que le fait compterait les entrées refusées.
    const bloc = audio.slice(audio.indexOf("joinedRef.current = true;"));
    expect(bloc.slice(0, 400)).toContain("recordRoomJoined()");
  });

  it("laisse la base attribuer l'acteur de l'entrée", async () => {
    const actions = await source("src/app/(app)/rooms/audio-actions.ts");
    const bloc = /export async function recordRoomJoined[\s\S]*?\n}/.exec(actions)![0];
    expect(bloc).toContain("auth.getUser()");
    expect(bloc).not.toMatch(/p_actor|actor_id/);
  });
});
