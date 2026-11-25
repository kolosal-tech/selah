import { createHash } from "node:crypto";

const base = process.env.NEXT_PUBLIC_SELAH_VPS_URL;
const anon = process.env.NEXT_PUBLIC_SELAH_VPS_ANON_KEY;

function connectWebSocket(session) {
  return new Promise((resolve, reject) => {
    const url = new URL("/realtime/v1/websocket", base);
    url.protocol = "wss:";
    url.searchParams.set("apikey", anon);
    url.searchParams.set("vsn", "1.0.0");
    const ws = new WebSocket(url);
    const timer = setTimeout(() => finish(false), 12000);
    const tables = ["room_audio_participants", "room_audio_signals", "room_messages"];
    function finish(ok) {
      clearTimeout(timer);
      ws.close();
      if (ok) resolve();
      else reject(new Error("Realtime VPS non vérifié"));
    }
    ws.addEventListener("open", () => ws.send(JSON.stringify({
      topic: "realtime:selah_vercel_migration", event: "phx_join", ref: "1",
      payload: { access_token: session, config: {
        broadcast: { self: false }, presence: { key: "" }, private: false,
        postgres_changes: tables.map(table => ({ event: "*", schema: "public", table })),
      } },
    })));
    ws.addEventListener("error", () => finish(false));
    ws.addEventListener("message", (message) => {
      const reply = JSON.parse(message.data);
      if (reply.event !== "phx_reply" || reply.ref !== "1") return;
      const active = reply.payload?.response?.postgres_changes;
      finish(reply.payload?.status === "ok" &&
        Array.isArray(active) && active.map(item => item.table).sort().join() === tables.join());
    });
  });
}

async function main() {
  if (!base) return;
  if (!anon) throw new Error("Accès public Selah absent");
  const settings = await fetch(base + "/auth/v1/settings", {
    headers: { apikey: anon }, signal: AbortSignal.timeout(5000),
  });
  if (!settings.ok || (await settings.json()).external?.email !== true) {
    throw new Error("Auth Selah non vérifiée");
  }
  const fixture = process.env.SELAH_VPS_FIXTURE;
  if (!fixture) {
    console.log("SELAH_VPS_BUILD_OK auth=true");
    return;
  }
  const test = JSON.parse(fixture);
  const auth = await fetch(base + "/auth/v1/token?grant_type=password", {
    method: "POST", headers: { apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ email: test.email, password: test.password }),
    signal: AbortSignal.timeout(6000),
  });
  if (!auth.ok) throw new Error("Connexion fictive refusée");
  const session = await auth.json();
  const key = process.env.SELAH_VPS_SERVICE_ROLE_KEY;
  const url = base + "/storage/v1/object/authenticated/avatars/__migration_selah_2511/fixture.png";
  const [storage] = await Promise.all([
    fetch(url, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    }),
    connectWebSocket(session.access_token),
  ]);
  if (!storage.ok || createHash("sha256").update(Buffer.from(await storage.arrayBuffer())).digest("hex") !==
      "8ec3a5773cb65b2c52dc7dd209ad0ad9b07bb73b9218b8ff8d37a99f348d349d") {
    throw new Error("Stockage Selah non vérifié");
  }
  const guest = await fetch(url, { headers: { apikey: anon }, signal: AbortSignal.timeout(5000) });
  if (guest.ok) throw new Error("Lecture anonyme du fichier privé");
  console.log("SELAH_VPS_BUILD_OK login=true stockage_prive_sha256=true realtime=3");
}

main().catch(() => {
  console.error("SELAH_VPS_BUILD_FAILED");
  process.exitCode = 1;
});
