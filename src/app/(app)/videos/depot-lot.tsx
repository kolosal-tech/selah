"use client";

import { useCallback, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { publishVideo } from "@/app/actions";
import {
  AlertTriangle,
  Check,
  FileJson,
  Layers,
  Loader2,
  RotateCcw,
  UploadCloud,
} from "lucide-react";

const MAX_OCTETS = 50 * 1024 * 1024;
const TYPES_OK = ["video/mp4", "video/webm", "video/quicktime"];
const DUREE_MAX_S = 300;
const EN_PARALLELE = 2;

const TYPES_POST = [
  "temoignage",
  "exhortation",
  "priere",
  "enseignement",
  "louange",
] as const;

type Fiche = { type: string; verse_ref: string; caption: string };
type Manifeste = Record<string, Fiche>;

type Etat = "attente" | "envoi" | "publie" | "echec";
type Ligne = {
  fichier: File;
  etat: Etat;
  message: string;
  fiche: Fiche | null;
};

/** Extension attendue par la validation serveur du chemin de stockage. */
function extensionDe(type: string): string {
  if (type.includes("mp4")) return "mp4";
  if (type.includes("quicktime")) return "mov";
  return "webm";
}

/**
 * Lit la durée et capture une vignette, sans afficher la vidéo : un élément
 * hors document suffit, et on relâche l'URL objet dans tous les cas.
 */
async function sonderVideo(
  fichier: File,
): Promise<{ duree: number; vignette: Blob | null }> {
  const url = URL.createObjectURL(fichier);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    const duree = await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () =>
        resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : 0);
      video.onerror = () => reject(new Error("vidéo illisible"));
    });

    // Vignette prise à 40 % : au début, beaucoup de vidéos ouvrent sur un noir.
    const vignette = await new Promise<Blob | null>((resolve) => {
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx || !canvas.width) return resolve(null);
          ctx.drawImage(video, 0, 0);
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8);
        } catch {
          resolve(null);
        }
      };
      video.onerror = () => resolve(null);
      video.currentTime = Math.max(0.1, (duree || 1) * 0.4);
    });

    return { duree, vignette };
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
  }
}

export function DepotLot({ userId }: { userId: string }) {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [manifeste, setManifeste] = useState<Manifeste | null>(null);
  const [nomManifeste, setNomManifeste] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [survol, setSurvol] = useState(false);
  const champRef = useRef<HTMLInputElement>(null);

  const fichePour = useCallback(
    (nom: string, m: Manifeste | null): Fiche | null => {
      const brut = m?.[nom];
      if (!brut) return null;
      const type = TYPES_POST.includes(brut.type as (typeof TYPES_POST)[number])
        ? brut.type
        : "temoignage";
      return {
        type,
        verse_ref: String(brut.verse_ref ?? "").slice(0, 80),
        caption: String(brut.caption ?? "").slice(0, 500),
      };
    },
    [],
  );

  const accepter = useCallback(
    async (fichiers: File[]) => {
      setErreur("");
      let m = manifeste;

      // Un manifeste déposé avec les vidéos est pris au vol.
      const json = fichiers.find((f) => f.name.toLowerCase().endsWith(".json"));
      if (json) {
        try {
          const lu = JSON.parse(await json.text()) as Manifeste;
          m = lu;
          setManifeste(lu);
          setNomManifeste(json.name);
        } catch {
          setErreur(`${json.name} n'est pas un JSON valide.`);
        }
      }

      const videos = fichiers.filter((f) => !f.name.toLowerCase().endsWith(".json"));
      const refusees: string[] = [];
      const retenues = videos.filter((f) => {
        if (!TYPES_OK.includes(f.type)) {
          refusees.push(`${f.name} — format refusé`);
          return false;
        }
        if (f.size > MAX_OCTETS) {
          refusees.push(`${f.name} — plus de 50 Mo`);
          return false;
        }
        return true;
      });
      if (refusees.length) setErreur(refusees.join(" · "));

      setLignes((avant) => {
        const deja = new Set(avant.map((l) => l.fichier.name));
        const neuves = retenues
          .filter((f) => !deja.has(f.name))
          .map<Ligne>((f) => ({
            fichier: f,
            etat: "attente",
            message: "",
            fiche: fichePour(f.name, m),
          }));
        // Ordre du manifeste ignoré : le nom de fichier porte déjà le rang.
        return [...avant, ...neuves].sort((a, b) =>
          a.fichier.name.localeCompare(b.fichier.name, "fr"),
        );
      });
    },
    [manifeste, fichePour],
  );

  /** Publie une ligne. Renvoie le message d'échec, ou null si tout s'est bien passé. */
  async function publierUne(ligne: Ligne): Promise<string | null> {
    const { fichier, fiche } = ligne;
    const supabase = supabaseBrowser();
    const id = crypto.randomUUID();
    const chemin = `${userId}/${id}.${extensionDe(fichier.type)}`;

    let duree = 0;
    let vignette: Blob | null = null;
    try {
      const sonde = await sonderVideo(fichier);
      duree = sonde.duree;
      vignette = sonde.vignette;
    } catch {
      // Sondage impossible : on publie quand même, sans vignette ni durée.
    }
    if (duree > DUREE_MAX_S) return `durée ${duree} s — maximum ${DUREE_MAX_S} s`;

    const { error } = await supabase.storage
      .from("videos")
      .upload(chemin, fichier, { contentType: fichier.type });
    if (error) return `envoi refusé — ${error.message}`;

    let cheminVignette = "";
    if (vignette) {
      const { error: errV } = await supabase.storage
        .from("videos")
        .upload(`${userId}/${id}.jpg`, vignette, { contentType: "image/jpeg" });
      if (!errV) cheminVignette = `${userId}/${id}.jpg`;
    }

    const donnees = new FormData();
    donnees.set("storage_path", chemin);
    donnees.set("thumb_path", cheminVignette);
    donnees.set("duration_s", String(duree));
    donnees.set("caption", fiche?.caption ?? "");
    donnees.set("verse_ref", fiche?.verse_ref ?? "");
    donnees.set("type", fiche?.type ?? "temoignage");

    const resultat = await publishVideo(donnees);
    return resultat?.ok ? null : "publication refusée — reconnecte-toi";
  }

  async function lancer() {
    setEnCours(true);
    setErreur("");

    // File d'attente partagée : quelques envois de front, pas tous à la fois,
    // pour ne pas saturer la connexion sur un lien lent.
    const restants = lignes
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.etat === "attente" || l.etat === "echec");
    let curseur = 0;

    const majLigne = (i: number, etat: Etat, message = "") =>
      setLignes((avant) =>
        avant.map((l, k) => (k === i ? { ...l, etat, message } : l)),
      );

    async function ouvrier() {
      for (;;) {
        const tache = restants[curseur++];
        if (!tache) return;
        majLigne(tache.i, "envoi");
        try {
          const echec = await publierUne(tache.l);
          majLigne(tache.i, echec ? "echec" : "publie", echec ?? "");
        } catch (e) {
          majLigne(tache.i, "echec", e instanceof Error ? e.message : "erreur");
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(EN_PARALLELE, restants.length) }, ouvrier),
    );
    setEnCours(false);
  }

  const publiees = lignes.filter((l) => l.etat === "publie").length;
  const echecs = lignes.filter((l) => l.etat === "echec").length;
  const aFaire = lignes.filter((l) => l.etat === "attente" || l.etat === "echec").length;
  const sansFiche = lignes.filter((l) => !l.fiche).length;

  return (
    <div className="glass-card p-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
        <Layers className="h-4 w-4" />
        <span>Dépôt en lot</span>
      </p>
      <p className="mt-2 text-sm text-white/70">
        Dépose plusieurs vidéos d&apos;un coup, avec leur fichier{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">.json</code> de
        légendes. Chaque vidéo part avec sa légende, son type et sa référence, sans
        rien saisir.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          void accepter(Array.from(e.dataTransfer.files));
        }}
        onClick={() => champRef.current?.click()}
        className={`mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          survol
            ? "border-amber-400/70 bg-amber-500/10"
            : "border-white/20 bg-white/5 hover:border-white/35 hover:bg-white/10"
        }`}
      >
        <UploadCloud className="h-8 w-8 text-amber-400" />
        <p className="text-sm font-semibold text-white">
          Glisse les fichiers ici, ou clique pour les choisir
        </p>
        <p className="text-xs text-white/50">
          MP4, WebM ou MOV · 50 Mo et 5 minutes maximum par vidéo
        </p>
      </div>
      <input
        ref={champRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,video/quicktime,application/json,.json"
        className="hidden"
        onChange={(e) => {
          void accepter(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {nomManifeste && (
        <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
          <FileJson className="h-3.5 w-3.5" />
          <span>
            {nomManifeste} — {Object.keys(manifeste ?? {}).length} fiche(s) chargée(s)
          </span>
        </p>
      )}
      {erreur && (
        <p className="mt-3 flex items-start gap-2 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{erreur}</span>
        </p>
      )}

      {lignes.length > 0 && (
        <>
          <ul className="mt-5 flex flex-col gap-1.5">
            {lignes.map((l) => (
              <li
                key={l.fichier.name}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
              >
                <span className="shrink-0">
                  {l.etat === "publie" && <Check className="h-4 w-4 text-emerald-400" />}
                  {l.etat === "envoi" && (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  )}
                  {l.etat === "echec" && (
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                  )}
                  {l.etat === "attente" && (
                    <span className="block h-2 w-2 rounded-full bg-white/30" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-white/85">
                  {l.fichier.name}
                </span>
                {l.fiche ? (
                  <span className="hidden shrink-0 text-white/45 sm:inline">
                    {l.fiche.type} · {l.fiche.verse_ref || "sans référence"}
                  </span>
                ) : (
                  <span className="shrink-0 text-amber-300/80">sans fiche</span>
                )}
                {l.message && (
                  <span className="shrink-0 text-rose-300">{l.message}</span>
                )}
              </li>
            ))}
          </ul>

          {sansFiche > 0 && (
            <p className="mt-3 text-xs text-amber-300/90">
              {sansFiche} vidéo(s) sans entrée dans le manifeste : elles partiront
              sans légende, en type « témoignage ».
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void lancer()}
              disabled={enCours || aFaire === 0}
              className="btn-paradise flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              {enCours ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : echecs > 0 ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              <span>
                {enCours
                  ? "Publication en cours…"
                  : echecs > 0
                    ? `Reprendre les ${echecs} en échec`
                    : `Publier les ${aFaire} vidéos`}
              </span>
            </button>
            <span className="text-xs text-white/60">
              {publiees} publiée(s)
              {echecs > 0 && ` · ${echecs} en échec`}
              {" · "}
              {lignes.length} au total
            </span>
          </div>
        </>
      )}
    </div>
  );
}
