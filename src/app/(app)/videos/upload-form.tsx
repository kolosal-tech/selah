"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { publishVideo } from "@/app/actions";
import { useMessages } from "@/i18n/client";
import {
  AUDIO_MIME_TYPES,
  decrireFichierMedia,
  extensionPourMime,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_DURATION_SECONDS,
  type MediaKind,
} from "@/lib/media-files";
import {
  Camera,
  Check,
  FolderOpen,
  Loader2,
  Mic,
  RefreshCcw,
  Square,
  Video,
} from "lucide-react";

type Mode = "choix" | "camera" | "apercu" | "envoi" | "publie";
type CameraStatus = "idle" | "requesting" | "granted" | "denied";

const VIDEO_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

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
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [enregistre, setEnregistre] = useState(false);
  const [tempsEcoule, setTempsEcoule] = useState(0);
  const [audioActif, setAudioActif] = useState(false);
  const [mediaKind, setMediaKind] = useState<MediaKind>("video");

  // Média retenu (enregistré ou choisi) et sa durée mesurée.
  const [blob, setBlob] = useState<Blob | null>(null);
  const [urlApercu, setUrlApercu] = useState<string | null>(null);
  const dureeRef = useRef(0);

  const cameraNativeRef = useRef<HTMLInputElement>(null);
  const fichierVideoRef = useRef<HTMLInputElement>(null);
  const fichierAudioRef = useRef<HTMLInputElement>(null);
  const directRef = useRef<HTMLVideoElement>(null);
  const apercuRef = useRef<HTMLVideoElement>(null);
  const apercuAudioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const morceauxRef = useRef<BlobPart[]>([]);
  const debutRef = useRef(0);
  const compteRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadIdRef = useRef<string | null>(null);
  const mediaMetaRef = useRef<{ mimeType: string; extension: string } | null>(null);

  const formatRefuse = (kind: MediaKind) =>
    kind === "audio"
      ? m.studio.formatAudioRefuse
      : m.studio.formatRefuse;
  const tropLourd = (kind: MediaKind) =>
    kind === "audio" ? m.studio.audioTropLourd : m.studio.tropLourde;

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
    if (directRef.current) directRef.current.srcObject = null;
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

  // Le mode caméra est rendu avant que la ref vidéo existe. Attacher le flux
  // dans un effet évite la course qui produisait un écran noir après l'appui.
  useEffect(() => {
    if (
      mode !== "camera" ||
      mediaKind !== "video" ||
      !streamRef.current ||
      !directRef.current
    ) {
      return;
    }
    directRef.current.srcObject = streamRef.current;
    void directRef.current.play().catch(() => setErreur(m.studio.cameraInaccessible));
  }, [mediaKind, mode, m.studio.cameraInaccessible]);

  function retenir(
    nouveau: Blob,
    duree: number,
    kind: MediaKind,
    mimeType: string,
    extension: string,
  ) {
    if (nouveau.size === 0) {
      setErreur(formatRefuse(kind));
      setMode("choix");
      return;
    }
    if (nouveau.size > MAX_MEDIA_BYTES) {
      setErreur(tropLourd(kind));
      setMode("choix");
      return;
    }
    if (duree > MAX_MEDIA_DURATION_SECONDS) {
      setErreur(m.studio.dureeMax(MAX_MEDIA_DURATION_SECONDS / 60));
      setMode("choix");
      return;
    }
    if (urlApercu) URL.revokeObjectURL(urlApercu);
    dureeRef.current = duree;
    uploadIdRef.current = crypto.randomUUID();
    mediaMetaRef.current = { mimeType, extension };
    setMediaKind(kind);
    setBlob(nouveau);
    setUrlApercu(URL.createObjectURL(nouveau));
    setMode("apercu");
  }

  async function ouvrirCapture(kind: MediaKind) {
    setErreur("");
    setCameraStatus("requesting");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setCameraDispo(false);
      setCameraStatus("denied");
      setErreur(kind === "audio" ? m.studio.audioIndisponible : m.studio.cameraIndispo);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: kind === "video" ? { facingMode: "user", aspectRatio: 9 / 16 } : false,
        audio: true,
      });
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        setCameraStatus("denied");
        setErreur(m.studio.audioIndisponible);
        return;
      }
      if (kind === "video" && stream.getVideoTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        setCameraStatus("denied");
        setErreur(m.studio.cameraIndispo);
        return;
      }
      streamRef.current = stream;
      setMediaKind(kind);
      setCameraStatus("granted");
      setAudioActif(true);
      setMode("camera");
      setEnregistre(false);
      setTempsEcoule(0);
    } catch (cause) {
      setCameraStatus("denied");
      const nom = cause instanceof DOMException ? cause.name : "";
      setErreur(
        nom === "NotFoundError" || nom === "OverconstrainedError"
          ? m.studio.cameraIndispo
          : m.studio.cameraInaccessible,
      );
    }
  }

  async function sonderDuree(fichier: File, kind: MediaKind): Promise<number | null> {
    const url = URL.createObjectURL(fichier);
    const media = document.createElement(kind === "audio" ? "audio" : "video");
    media.preload = "metadata";
    media.src = url;
    try {
      return await new Promise<number | null>((resolve) => {
        media.onloadedmetadata = () =>
          resolve(
            Number.isFinite(media.duration) && media.duration > 0
              ? Math.ceil(media.duration)
              : null,
          );
        media.onerror = () => resolve(null);
      });
    } finally {
      media.removeAttribute("src");
      media.load();
      URL.revokeObjectURL(url);
    }
  }

  function demarrerEnregistrement() {
    const stream = streamRef.current;
    if (!stream) return;
    if (stream.getAudioTracks().length === 0) {
      setErreur(m.studio.audioIndisponible);
      setAudioActif(false);
      return;
    }
    morceauxRef.current = [];
    const candidats =
      mediaKind === "audio" ? AUDIO_MIME_CANDIDATES : VIDEO_MIME_CANDIDATES;
    const mime = candidats.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mime) {
      setErreur(formatRefuse(mediaKind));
      return;
    }
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      setErreur(formatRefuse(mediaKind));
      return;
    }
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) morceauxRef.current.push(e.data);
    };
    rec.onerror = () => {
      rec.onstop = null;
      recorderRef.current = null;
      morceauxRef.current = [];
      arreterFlux();
      setEnregistre(false);
      setMode("choix");
      setErreur(m.studio.cameraInaccessible);
    };
    rec.onstop = () => {
      // Durée mesurée nous-mêmes : `duration` d'un blob MediaRecorder vaut
      // souvent Infinity tant que les métadonnées ne sont pas finalisées.
      const duree = Math.max(1, Math.ceil((Date.now() - debutRef.current) / 1000));
      setEnregistre(false);
      recorderRef.current = null;
      arreterFlux();
      const mimeFinal = rec.mimeType || mime;
      const enregistrement = new Blob(morceauxRef.current, { type: mimeFinal });
      morceauxRef.current = [];
      const extension = extensionPourMime(mimeFinal, mediaKind);
      if (!extension) {
        setErreur(formatRefuse(mediaKind));
        setMode("choix");
        return;
      }
      retenir(
        enregistrement,
        duree,
        mediaKind,
        mimeFinal.split(";", 1)[0],
        extension,
      );
    };
    debutRef.current = Date.now();
    setTempsEcoule(0);
    try {
      rec.start(250);
      setEnregistre(true);
      setErreur("");
    } catch {
      recorderRef.current = null;
      setErreur(m.studio.cameraInaccessible);
      return;
    }
    compteRef.current = setInterval(() => {
      const ecoule = Math.floor((Date.now() - debutRef.current) / 1000);
      setTempsEcoule(Math.min(MAX_MEDIA_DURATION_SECONDS, ecoule));
      if (ecoule >= MAX_MEDIA_DURATION_SECONDS) arreterEnregistrement();
    }, 500);
  }

  function annulerCapture() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    recorderRef.current = null;
    morceauxRef.current = [];
    arreterFlux();
    setEnregistre(false);
    setAudioActif(false);
    setCameraStatus("idle");
    setErreur("");
    setMode("choix");
  }

  function arreterEnregistrement() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  async function choisirFichier(fichier: File | undefined, attendu: MediaKind) {
    setErreur("");
    if (!fichier) return;
    const descriptor = decrireFichierMedia(fichier, attendu);
    if (!descriptor) {
      setErreur(formatRefuse(attendu));
      return;
    }
    if (fichier.size > MAX_MEDIA_BYTES) {
      setErreur(tropLourd(attendu));
      return;
    }
    const duree = await sonderDuree(fichier, descriptor.kind);
    if (duree === null) {
      setErreur(formatRefuse(attendu));
      return;
    }
    retenir(
      fichier,
      duree,
      descriptor.kind,
      descriptor.mimeType,
      descriptor.extension,
    );
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

    const id = uploadIdRef.current ?? crypto.randomUUID();
    uploadIdRef.current = id;
    const metadata = mediaMetaRef.current;
    if (!metadata) {
      setMode("apercu");
      setErreur(formatRefuse(mediaKind));
      return;
    }
    const { extension, mimeType } = metadata;
    const cheminVideo = `${userId}/${id}.${extension}`;

    // Durée : mesurée à l'enregistrement, sinon lue sur l'élément d'aperçu.
    let duree = dureeRef.current;
    const metaDuree =
      mediaKind === "audio"
        ? apercuAudioRef.current?.duration
        : apercuRef.current?.duration;
    if (!duree && metaDuree && Number.isFinite(metaDuree)) {
      duree = Math.round(metaDuree);
    }

    if (duree > MAX_MEDIA_DURATION_SECONDS) {
      setMode("apercu");
      setErreur(m.studio.dureeMax(MAX_MEDIA_DURATION_SECONDS / 60));
      return;
    }

    const vignette = mediaKind === "video" ? await capturerVignette() : null;

    const supabase = supabaseBrowser();
    const { error } = await supabase.storage
      .from("videos")
      .upload(cheminVideo, blob, { contentType: mimeType, upsert: true });
    if (error) {
      setMode("apercu");
      setErreur(m.studio.publicationRefusee);
      return;
    }

    let cheminVignette = "";
    if (vignette) {
      const { error: errVignette } = await supabase.storage
        .from("videos")
        .upload(`${userId}/${id}.jpg`, vignette, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (!errVignette) cheminVignette = `${userId}/${id}.jpg`;
    }

    formData.set("storage_path", cheminVideo);
    formData.set("thumb_path", cheminVignette);
    formData.set("duration_s", String(duree));
    const resultat = await publishVideo(formData);
    if (!resultat?.ok) {
      await supabase.storage
        .from("videos")
        .remove([cheminVideo, ...(cheminVignette ? [cheminVignette] : [])]);
      setMode("apercu");
      setErreur(m.studio.publicationRefusee);
      return;
    }
    if (urlApercu) URL.revokeObjectURL(urlApercu);
    setBlob(null);
    setUrlApercu(null);
    uploadIdRef.current = null;
    mediaMetaRef.current = null;
    setMode("publie");
  }

  function recommencer() {
    arreterFlux();
    setEnregistre(false);
    setAudioActif(false);
    setCameraStatus("idle");
    if (urlApercu) URL.revokeObjectURL(urlApercu);
    setBlob(null);
    setUrlApercu(null);
    uploadIdRef.current = null;
    mediaMetaRef.current = null;
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
                type="button"
                onClick={() => void ouvrirCapture("video")}
                disabled={cameraStatus === "requesting"}
                className="btn-paradise flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition hover:scale-105 disabled:cursor-wait disabled:opacity-60"
              >
                <Camera className="h-4 w-4" />
                <span>{m.studio.enregistrer}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => cameraNativeRef.current?.click()}
              className="flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-amber-300/20"
            >
              <Camera className="h-4 w-4" />
              <span>{m.studio.filmerMobile}</span>
            </button>
            {cameraDispo && (
              <button
                type="button"
                onClick={() => void ouvrirCapture("audio")}
                disabled={cameraStatus === "requesting"}
                className="flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-300/20 disabled:cursor-wait disabled:opacity-60"
              >
                <Mic className="h-4 w-4" />
                <span>{m.studio.enregistrerAudio}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => fichierVideoRef.current?.click()}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-white/20"
            >
              <FolderOpen className="h-4 w-4" />
              <span>{m.studio.choisirVideo}</span>
            </button>
            <button
              type="button"
              onClick={() => fichierAudioRef.current?.click()}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-xl transition hover:bg-white/20"
            >
              <FolderOpen className="h-4 w-4" />
              <span>{m.studio.choisirAudio}</span>
            </button>
          </div>
          {!cameraDispo && (
            <p className="text-xs text-white/50">
              {m.studio.cameraIndispo}
            </p>
          )}
          <input
            ref={cameraNativeRef}
            type="file"
            accept="video/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              void choisirFichier(e.target.files?.[0], "video");
              e.target.value = "";
            }}
          />
          <input
            ref={fichierVideoRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mov"
            className="hidden"
            onChange={(e) => {
              void choisirFichier(e.target.files?.[0], "video");
              e.target.value = "";
            }}
          />
          <input
            ref={fichierAudioRef}
            type="file"
            accept={`${AUDIO_MIME_TYPES.join(",")},.mp3,.m4a,.weba,.ogg,.oga,.wav`}
            className="hidden"
            onChange={(e) => {
              void choisirFichier(e.target.files?.[0], "audio");
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* ── Direct caméra ── */}
      {mode === "camera" && (
        <div className="relative mx-auto aspect-[9/16] max-h-[70vh] w-full bg-black">
          {mediaKind === "video" ? (
            <video
              ref={directRef}
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-5 bg-gradient-to-b from-emerald-950 via-slate-950 to-black">
              <span className="flex h-28 w-28 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 shadow-[0_0_60px_rgba(52,211,153,0.2)]">
                <Mic className="h-12 w-12 text-emerald-200" />
              </span>
              <p className="text-sm font-semibold text-white/75">
                {m.studio.microPret}
              </p>
            </div>
          )}
          <span
            role="status"
            aria-live="polite"
            className={`glass-pill absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-4 py-1.5 text-center text-sm font-bold ${
              enregistre ? "text-rose-400" : "text-white/85"
            }`}
          >
            {enregistre
              ? `● ${m.studio.enregistrement} · ${Math.floor(tempsEcoule / 60)}:${String(tempsEcoule % 60).padStart(2, "0")} / 5:00`
              : mediaKind === "audio"
                ? m.studio.microAutorise
                : m.studio.cameraAutorisation}
            {audioActif && <span className="ms-2 text-emerald-300">· {m.studio.audioActif}</span>}
          </span>
          <div className="absolute inset-x-0 bottom-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))] flex items-center justify-center gap-6 sm:bottom-6">
            {!enregistre ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    annulerCapture();
                  }}
                  className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-xl"
                >
                  {m.commun.annuler}
                </button>
                <button
                  type="button"
                  onClick={demarrerEnregistrement}
                  aria-label={m.studio.demarrer}
                  className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-rose-500 shadow-2xl transition hover:scale-105"
                >
                  <span className="h-6 w-6 rounded-full bg-white/20" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={arreterEnregistrement}
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
            {mediaKind === "video" ? (
              <video
                ref={apercuRef}
                src={urlApercu}
                loop
                muted
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-emerald-950 via-slate-950 to-black px-6 pb-52">
                <span className="flex h-28 w-28 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 shadow-[0_0_60px_rgba(52,211,153,0.2)]">
                  <Mic className="h-12 w-12 text-emerald-200" />
                </span>
                <p className="text-center text-sm font-semibold text-white/80">
                  {m.studio.apercuAudio}
                </p>
                <audio
                  ref={apercuAudioRef}
                  src={urlApercu}
                  controls
                  preload="metadata"
                  className="w-full max-w-sm"
                />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />

            {/* Saisie par-dessus l'aperçu */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 pb-[max(7rem,calc(6rem+env(safe-area-inset-bottom)))] sm:pb-4">
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
                  {mediaKind === "video" && (
                    <>
                      <option value="enseignement">{m.studio.typeEnseignement}</option>
                      <option value="louange">{m.studio.typeLouange}</option>
                    </>
                  )}
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
