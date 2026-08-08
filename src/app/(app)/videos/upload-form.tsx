"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { publishVideo } from "@/app/actions";
import { useMessages } from "@/i18n/client";
import {
  Camera,
  Check,
  FolderOpen,
  Loader2,
  RefreshCcw,
  Square,
  Video,
} from "lucide-react";

const MAX_OCTETS = 50 * 1024 * 1024;
const TYPES_OK = ["video/mp4", "video/webm", "video/quicktime"];
const DUREE_MAX_S = 180;

type Mode = "choix" | "camera" | "apercu" | "envoi" | "publie";

/**
 * Studio de publication : enregistrer face caméra ou déposer un fichier,
 * prévisualiser, puis publier. Le fichier part directement du navigateur
 * vers Supabase Storage (jamais par le serveur Next) ; une vignette est
 * capturée sur canvas et déposée à côté (`<uid>/<uuid>.jpg`) pour servir de
 * poster dans le feed.
 */
export function UploadForm({ userId }: { userId: string }) {
  const m = useMessages();
  const [mode, setMode] = useState<Mode>("choix");
  const [erreur, setErreur] = useState("");
  const [cameraDispo, setCameraDispo] = useState(true);
  const [enregistre, setEnregistre] = useState(false);
  const [tempsRestant, setTempsRestant] = useState(DUREE_MAX_S);

  // Vidéo retenue (enregistrée ou choisie) et sa durée mesurée.
  const [blob, setBlob] = useState<Blob | null>(null);
  const [urlApercu, setUrlApercu] = useState<string | null>(null);
  const dureeRef = useRef(0);

  const fichierRef = useRef<HTMLInputElement>(null);
  const directRef = useRef<HTMLVideoElement>(null);
  const apercuRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const morceauxRef = useRef<BlobPart[]>([]);
  const debutRef = useRef(0);
  const compteRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Différé d'une frame : détection après hydratation (le serveur rend
    // toujours l'option caméra, retirée ici si le navigateur ne sait pas).
    const t = requestAnimationFrame(() => {
      setCameraDispo(
        Boolean(navigator.mediaDevices?.getUserMedia) &&
          typeof MediaRecorder !== "undefined",
      );
    });
    return () => cancelAnimationFrame(t);
  }, []);

  const arreterFlux = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (compteRef.current) {
      clearInterval(compteRef.current);
      compteRef.current = null;
    }
  }, []);

  // À la sortie du composant : caméra coupée, URL blob libérée.
  useEffect(() => {
    return () => {
      arreterFlux();
      if (urlApercu) URL.revokeObjectURL(urlApercu);
    };
  }, [arreterFlux, urlApercu]);

  function retenir(nouveau: Blob, duree: number) {
    if (urlApercu) URL.revokeObjectURL(urlApercu);
    dureeRef.current = duree;
    setBlob(nouveau);
    setUrlApercu(URL.createObjectURL(nouveau));
    setMode("apercu");
  }

  async function ouvrirCamera() {
    setErreur("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", aspectRatio: 9 / 16 },
        audio: true,
      });
      streamRef.current = stream;
      setMode("camera");
      setEnregistre(false);
      setTempsRestant(DUREE_MAX_S);
      // Le <video> du direct n'existe qu'après le rendu du mode caméra.
      requestAnimationFrame(() => {
        if (directRef.current) {
          directRef.current.srcObject = stream;
          directRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraDispo(false);
      setErreur(m.studio.cameraInaccessible);
    }
  }

  function demarrerEnregistrement() {
    const stream = streamRef.current;
    if (!stream) return;
    morceauxRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) morceauxRef.current.push(e.data);
    };
    rec.onstop = () => {
      // Durée mesurée nous-mêmes : `duration` d'un blob MediaRecorder vaut
      // souvent Infinity tant que les métadonnées ne sont pas finalisées.
      const duree = Math.round((Date.now() - debutRef.current) / 1000);
      arreterFlux();
      retenir(new Blob(morceauxRef.current, { type: mime }), duree);
    };
    debutRef.current = Date.now();
    setEnregistre(true);
    rec.start();
    compteRef.current = setInterval(() => {
      const ecoule = Math.round((Date.now() - debutRef.current) / 1000);
      const restant = DUREE_MAX_S - ecoule;
      setTempsRestant(restant);
      if (restant <= 0) recorderRef.current?.stop();
    }, 500);
  }

  function choisirFichier(fichier: File | undefined) {
    setErreur("");
    if (!fichier) return;
    if (!TYPES_OK.includes(fichier.type)) {
      setErreur(m.studio.formatRefuse);
      return;
    }
    if (fichier.size > MAX_OCTETS) {
      setErreur(m.studio.tropLourde);
      return;
    }
    retenir(fichier, 0);
  }

  /** Capture une frame de l'aperçu en JPEG. Échec = pas de vignette, tant pis. */
  async function capturerVignette(): Promise<Blob | null> {
    const video = apercuRef.current;
    if (!video || video.readyState < 2) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx || !canvas.width) return null;
      ctx.drawImage(video, 0, 0);
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
      );
    } catch {
      return null;
    }
  }

  async function publier(formData: FormData) {
    if (!blob) return;
    setMode("envoi");
    setErreur("");

    const id = crypto.randomUUID();
    const extension = blob.type.includes("mp4")
      ? "mp4"
      : blob.type.includes("quicktime")
        ? "mov"
        : "webm";
    const cheminVideo = `${userId}/${id}.${extension}`;

    // Durée : mesurée à l'enregistrement, sinon lue sur l'élément d'aperçu.
    let duree = dureeRef.current;
    const metaDuree = apercuRef.current?.duration;
    if (!duree && metaDuree && Number.isFinite(metaDuree)) {
      duree = Math.round(metaDuree);
    }

    const vignette = await capturerVignette();

    const supabase = supabaseBrowser();
    const { error } = await supabase.storage
      .from("videos")
      .upload(cheminVideo, blob, { contentType: blob.type });
    if (error) {
      setMode("apercu");
      setErreur(m.studio.envoiRefuse(error.message));
      return;
    }

    let cheminVignette = "";
    if (vignette) {
      const { error: errVignette } = await supabase.storage
        .from("videos")
        .upload(`${userId}/${id}.jpg`, vignette, { contentType: "image/jpeg" });
      if (!errVignette) cheminVignette = `${userId}/${id}.jpg`;
    }

    formData.set("storage_path", cheminVideo);
    formData.set("thumb_path", cheminVignette);
    formData.set("duration_s", String(duree));
    const resultat = await publishVideo(formData);
    if (!resultat?.ok) {
      setMode("apercu");
      setErreur(m.studio.publicationRefusee);
      return;
    }
    if (urlApercu) URL.revokeObjectURL(urlApercu);
    setBlob(null);
    setUrlApercu(null);
    setMode("publie");
  }

  function recommencer() {
    if (urlApercu) URL.revokeObjectURL(urlApercu);
    setBlob(null);
    setUrlApercu(null);
    setErreur("");
    setMode("choix");
  }

  return (
    <div className="glass-card overflow-hidden p-0">
      {/* ── Choix du point de départ ── */}
      {mode === "choix" && (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <Video className="h-10 w-10 text-amber-400" />
          <p className="text-sm text-white/80">
            {m.studio.sousTitre}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {cameraDispo && (
              <button
                onClick={ouvrirCamera}
 className="btn-paradise flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:scale-105"
              >
                <Camera className="h-4 w-4" />
                <span>{m.studio.enregistrer}</span>
              </button>
            )}
            <button
              onClick={() => fichierRef.current?.click()}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-white/20"
            >
              <FolderOpen className="h-4 w-4" />
              <span>{m.studio.choisirFichier}</span>
            </button>
          </div>
          {!cameraDispo && (
            <p className="text-xs text-white/50">
              {m.studio.cameraIndispo}
            </p>
          )}
          <input
            ref={fichierRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => choisirFichier(e.target.files?.[0])}
          />
        </div>
      )}

      {/* ── Direct caméra ── */}
      {mode === "camera" && (
        <div className="relative mx-auto aspect-[9/16] max-h-[70vh] w-full bg-black">
          <video
            ref={directRef}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          {enregistre && (
            <span className="glass-pill absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm font-bold text-rose-400">
              ● {Math.floor(tempsRestant / 60)}:{String(tempsRestant % 60).padStart(2, "0")}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-6">
            {!enregistre ? (
              <>
                <button
                  onClick={() => {
                    arreterFlux();
                    setMode("choix");
                  }}
                  className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-xl"
                >
                  {m.commun.annuler}
                </button>
                <button
                  onClick={demarrerEnregistrement}
                  aria-label={m.studio.demarrer}
                  className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-rose-500 shadow-2xl transition hover:scale-105"
                >
                  <span className="h-6 w-6 rounded-full bg-white/20" />
                </button>
              </>
            ) : (
              <button
                onClick={() => recorderRef.current?.stop()}
                aria-label={m.studio.arreter}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-rose-600 shadow-2xl"
              >
                <Square className="h-6 w-6 fill-white text-white" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Aperçu + publication ── */}
      {(mode === "apercu" || mode === "envoi") && urlApercu && (
        <form action={publier} className="relative">
          <div className="relative mx-auto aspect-[9/16] max-h-[70vh] w-full bg-black">
            <video
              ref={apercuRef}
              src={urlApercu}
              loop
              muted
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />

            {/* Saisie par-dessus l'aperçu */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
              <textarea
                name="caption"
                rows={2}
                maxLength={500}
                placeholder={m.studio.captionPlaceholder}
                className="glass-input w-full resize-none rounded-xl p-3 text-sm placeholder:text-white/40"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  name="type"
                  className="glass-input rounded-xl p-2.5 text-sm [&>option]:bg-slate-900"
                >
                  <option value="temoignage">{m.studio.typeTemoignage}</option>
                  <option value="exhortation">{m.studio.typeExhortation}</option>
                  <option value="enseignement">{m.studio.typeEnseignement}</option>
                  <option value="louange">{m.studio.typeLouange}</option>
                </select>
                <input
                  name="verse_ref"
                  maxLength={80}
                  placeholder={m.studio.versetPlaceholder}
                  className="glass-input min-w-0 flex-1 rounded-xl p-2.5 text-sm placeholder:text-white/40"
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={recommencer}
                  disabled={mode === "envoi"}
                  className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-xl disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  <span>{m.studio.reprendre}</span>
                </button>
                <button
                  disabled={mode === "envoi"}
 className="btn-paradise flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition hover:scale-105 disabled:opacity-60"
                >
                  {mode === "envoi" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{m.studio.envoi}</span>
                    </>
                  ) : (
                    <span>{m.commun.publier}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── Publiée ── */}
      {mode === "publie" && (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <Check className="h-7 w-7" />
          </span>
          <p className="font-bold text-white">{m.studio.publiee}</p>
          <div className="flex gap-3">
            <Link
              href="/"
 className="btn-paradise rounded-full px-6 py-2.5 text-sm font-bold "
            >
              {m.studio.voirFeed}
            </Link>
            <button
              onClick={recommencer}
              className="rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-xl"
            >
              {m.studio.publierAutre}
            </button>
          </div>
        </div>
      )}

      {erreur && (
        <p className="px-6 pb-4 text-center text-sm text-rose-400">{erreur}</p>
      )}
    </div>
  );
}
