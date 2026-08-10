"use client";

import { useCallback, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { publishVideo } from "@/app/actions";
import {
  decrireFichierMedia,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_DURATION_SECONDS,
  type MediaFileDescriptor,
} from "@/lib/media-files";
import {
  AlertTriangle,
  Check,
  FileJson,
  Layers,
  Loader2,
  RotateCcw,
  UploadCloud,
} from "lucide-react";

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
  uploadId: string;
  fichier: File;
  etat: Etat;
  message: string;
  fiche: Fiche | null;
  media: MediaFileDescriptor;
};

/**
 * Lit la durée et capture une vignette pour une vidéo. Un audio est seulement
 * sondé pour sa durée. L'URL objet est relâchée dans tous les cas.
 */
async function sonderMedia(
  fichier: File,
  media: MediaFileDescriptor,
): Promise<{ duree: number; vignette: Blob | null }> {
  const url = URL.createObjectURL(fichier);
  const element = document.createElement(media.kind === "audio" ? "audio" : "video");
  element.preload = "metadata";
  element.src = url;
  if (element instanceof HTMLVideoElement) {
    element.muted = true;
    element.playsInline = true;
  }

  try {
    const duree = await new Promise<number>((resolve, reject) => {
      element.onloadedmetadata = () => {
        if (!Number.isFinite(element.duration) || element.duration <= 0) {
          reject(new Error("média illisible"));
          return;
        }
        resolve(Math.ceil(element.duration));
      };
      element.onerror = () => reject(new Error("média illisible"));
    });

    if (!(element instanceof HTMLVideoElement)) {
      return { duree, vignette: null };
    }

    // Vignette prise à 40 % : au début, beaucoup de vidéos ouvrent sur un noir.
    const vignette = await new Promise<Blob | null>((resolve) => {
      element.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = element.videoWidth;
          canvas.height = element.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx || !canvas.width) return resolve(null);
          ctx.drawImage(element, 0, 0);
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8);
        } catch {
          resolve(null);
        }
      };
      element.onerror = () => resolve(null);
      element.currentTime = Math.max(0.1, duree * 0.4);
    });

    return { duree, vignette };
  } finally {
    URL.revokeObjectURL(url);
    element.removeAttribute("src");
    element.load();
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

      // Un manifeste déposé avec les médias est pris au vol.
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

      const medias = fichiers.filter((f) => !f.name.toLowerCase().endsWith(".json"));
      const refusees: string[] = [];
      const retenues = medias.flatMap((fichier) => {
        const media = decrireFichierMedia(fichier);
        if (!media) {
          refusees.push(`${fichier.name} — format refusé`);
          return [];
        }
        if (fichier.size > MAX_MEDIA_BYTES) {
          refusees.push(`${fichier.name} — plus de 50 Mo`);
          return [];
        }
        return [{ fichier, media }];
      });
      if (refusees.length) setErreur(refusees.join(" · "));

      setLignes((avant) => {
        const deja = new Set(avant.map((l) => l.fichier.name));
        const neuves = retenues
          .filter(({ fichier }) => !deja.has(fichier.name))
          .map<Ligne>(({ fichier, media }) => ({
            uploadId: crypto.randomUUID(),
            fichier,
            etat: "attente",
            message: "",
            fiche: fichePour(fichier.name, m),
            media,
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
    const { fichier, fiche, media } = ligne;
    const supabase = supabaseBrowser();
    const id = ligne.uploadId;
    const chemin = `${userId}/${id}.${media.extension}`;

    let duree = 0;
    let vignette: Blob | null = null;
    try {
      const sonde = await sonderMedia(fichier, media);
      duree = sonde.duree;
      vignette = sonde.vignette;
    } catch {
      return "média illisible — durée impossible à vérifier";
    }
    if (duree > MAX_MEDIA_DURATION_SECONDS) {
      return `durée ${duree} s — maximum ${MAX_MEDIA_DURATION_SECONDS} s`;
    }

    const { error } = await supabase.storage
      .from("videos")
      .upload(chemin, fichier, { contentType: media.mimeType, upsert: true });
    if (error) return "envoi refusé — vérifie ta connexion et réessaie";

    let cheminVignette = "";
    if (vignette) {
      const { error: errV } = await supabase.storage
        .from("videos")
        .upload(`${userId}/${id}.jpg`, vignette, {
          contentType: "image/jpeg",
          upsert: true,
        });
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
    if (resultat?.ok) return null;
    await supabase.storage
      .from("videos")
      .remove([chemin, ...(cheminVignette ? [cheminVignette] : [])]);
    return "publication refusée — reconnecte-toi";
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
        Dépose plusieurs vidéos ou audios d&apos;un coup, avec leur fichier{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">.json</code> de
        légendes. Chaque média part avec sa légende, son type et sa référence, sans
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
          MP4, WebM, MOV, MP3, M4A, OGG ou WAV · 50 Mo et 5 minutes maximum
        </p>
      </div>
      <input
        ref={champRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,audio/ogg,audio/wav,.mp3,.m4a,.weba,.ogg,.oga,.wav,application/json,.json"
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
              {sansFiche} média(s) sans entrée dans le manifeste : ils partiront
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
                    : `Publier les ${aFaire} médias`}
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
