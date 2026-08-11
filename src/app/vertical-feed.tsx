"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  addVideoComment,
  blockAuthor,
  prayForVideo,
  reportVideo,
  toggleFollow,
  toggleVideoAmen,
  unblockAuthor,
} from "@/app/actions";
import {
  REPORT_CATEGORIES,
  type BlockKind,
  type ReportCategory,
} from "@/lib/moderation";
import {
  BookOpen,
  Camera,
  Flag,
  Flame,
  Heart,
  HeartHandshake,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Plus,
  Send,
  Share2,
  Sparkles,
  ShieldOff,
  Volume2,
  VolumeX,
  X,
  Check,
} from "lucide-react";
import { FloatingPillNav, MotSelah } from "./nav-components";
import { useLocale, useMessages } from "@/i18n/client";
import { pseudo } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { feedCursorFilter } from "@/lib/feed-cursor";
import {
  readAppPreferences,
  subscribeAppPreferences,
  updateAppPreference,
} from "@/lib/app-preferences";
import { isAudioStoragePath } from "@/lib/media-files";

export type FeedVideo = {
  id: string;
  author_id: string;
  storage_path: string;
  thumb_path: string | null;
  media_url?: string | null;
  thumb_url?: string | null;
  caption: string | null;
  verse_ref: string | null;
  type: string;
  amen_count: number;
  pray_count: number;
  comment_count: number;
  duration_s: number | null;
  created_at: string;
  username: string | null;
  display_name: string | null;
  score: number;
  rang_auteur: number;
};

type Commentaire = {
  id: string;
  body: string;
  created_at: string;
  username: string;
};

type Amenateur = { id: string; username: string };

const TYPE_STYLE: Record<
  string,
  { bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  temoignage: { bg: "from-amber-500 to-rose-500", icon: Flame },
  exhortation: { bg: "from-emerald-500 to-teal-600", icon: Sparkles },
  priere: { bg: "from-cyan-500 to-blue-600", icon: HeartHandshake },
  enseignement: { bg: "from-blue-500 to-indigo-600", icon: BookOpen },
  louange: { bg: "from-purple-500 to-pink-600", icon: Music2 },
};

const PAGE = 24;
/** Fenêtre de préchargement : seules les vidéos à ±2 de l'écran ont un src. */
const FENETRE = 2;

function formatCompte(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function ageLabel(iso: string, m: Messages): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return m.temps.instant;
  if (min < 60) return m.temps.minutes(min);
  const h = Math.floor(min / 60);
  if (h < 24) return m.temps.heures(h);
  return m.temps.jours(Math.floor(h / 24));
}

export function VerticalFeed({
  initialVideos,
  me,
  initialAmened,
  initialPrie = [],
  initialSuivis = [],
  erreurInitiale = false,
}: {
  initialVideos: FeedVideo[];
  me: { id: string; username: string | null } | null;
  initialAmened: string[];
  initialPrie?: string[];
  initialSuivis?: string[];
  erreurInitiale?: boolean;
}) {
  const router = useRouter();
  const m = useMessages();
  const locale = useLocale();
  const [videos, setVideos] = useState(initialVideos);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fin, setFin] = useState(initialVideos.length < PAGE);
  const [cassees, setCassees] = useState<Set<string>>(new Set());

  // Interactions réelles, avec état optimiste par vidéo.
  const [amened, setAmened] = useState(() => new Set(initialAmened));
  const [prie, setPrie] = useState(() => new Set(initialPrie));
  const [suivis, setSuivis] = useState(() => new Set(initialSuivis));
  const [amenCounts, setAmenCounts] = useState<Record<string, number>>({});
  const [prayCounts, setPrayCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [halo, setHalo] = useState<string | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [partage, setPartage] = useState<string | null>(null);
  const [signalee, setSignalee] = useState<Set<string>>(new Set());
  const [amenOuverte, setAmenOuverte] = useState<FeedVideo | null>(null);
  // Panneau d'options : signaler avec motif, masquer, bloquer, voir moins.
  const [optionsPour, setOptionsPour] = useState<FeedVideo | null>(null);
  const [motifsPour, setMotifsPour] = useState<FeedVideo | null>(null);
  // Auteur retiré du fil à l'instant : le toast propose d'annuler.
  const [annulable, setAnnulable] = useState<string | null>(null);
  const [amenateurs, setAmenateurs] = useState<Amenateur[]>([]);
  const [chargeAmenateurs, setChargeAmenateurs] = useState(false);

  // Panneau commentaires : chargé à l'ouverture depuis la base.
  const [ouverte, setOuverte] = useState<FeedVideo | null>(null);
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [chargeCommentaires, setChargeCommentaires] = useState(false);
  const [nouveauCommentaire, setNouveauCommentaire] = useState("");
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRefs = useRef<(HTMLMediaElement | null)[]>([]);
  const chargementRef = useRef(false);
  const activeRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retraitRef = useRef<{
    authorId: string;
    entrees: { v: FeedVideo; i: number }[];
  } | null>(null);

  async function signerMedias(elements: FeedVideo[]): Promise<FeedVideo[]> {
    const paths = [
      ...new Set(
        elements
          .flatMap((v) => [v.storage_path, v.thumb_path])
          .filter((path): path is string => Boolean(path)),
      ),
    ];
    if (paths.length === 0) return elements;
    const { data } = await supabaseBrowser().storage.from("videos").createSignedUrls(paths, 60);
    const urls = new Map((data ?? []).map((item) => [item.path, item.signedUrl]));
    return elements.map((v) => ({
      ...v,
      media_url: urls.get(v.storage_path) ?? null,
      thumb_url: v.thumb_path ? (urls.get(v.thumb_path) ?? null) : null,
    }));
  }

  // Muet au rendu serveur, puis synchronisé avec le choix du profil et ses
  // changements dans le même onglet ou dans un autre onglet.
  useEffect(() => {
    const synchroniser = () => setMuted(!readAppPreferences().feedSound);
    const t = requestAnimationFrame(synchroniser);
    const unsubscribe = subscribeAppPreferences(synchroniser);
    return () => {
      cancelAnimationFrame(t);
      unsubscribe();
    };
  }, []);

  function basculerSon() {
    const feedSound = muted;
    setMuted(!feedSound);
    updateAppPreference("feedSound", feedSound);
  }

  // Observe chaque carte : celle qui occupe l'écran devient active.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const index = Number((e.target as HTMLElement).dataset.index);
          // observe() notifie aussi l'élément déjà visible (ex. après une
          // page ajoutée) : ignorer si la vidéo active n'a pas changé, sinon
          // une pause manuelle serait annulée spontanément.
          if (index === activeRef.current) continue;
          activeRef.current = index;
          setActive(index);
          setPaused(false);
        }
      },
      { root: container, threshold: 0.6 },
    );
    container.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [videos.length]);

  // Lecture : la vidéo active joue, les autres s'arrêtent.
  useEffect(() => {
    mediaRefs.current.forEach((v, i) => {
      if (!v) return;
      v.muted = muted;
      if (i === active && !paused) {
        v.play().catch(() => {
          // Autoplay refusé (iOS économie d'énergie, lecture non muette hors
          // geste) : afficher ▶ pour que le prochain tap lance la lecture.
          if (i === activeRef.current) setPaused(true);
        });
      } else {
        v.pause();
      }
    });
  }, [active, muted, paused, videos.length]);

  // Parallaxe « Reels » : la vidéo qui sort de l'écran rétrécit et s'assombrit
  // légèrement, pilotée par le scroll natif (aucune bibliothèque).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = container!.clientHeight;
        mediaRefs.current.forEach((vid) => {
          if (!vid) return;
          const rect = vid.getBoundingClientRect();
          const sortie = Math.min(1, Math.abs(rect.top) / h);
          vid.style.transform = `scale(${1 - sortie * 0.06})`;
          vid.style.opacity = String(1 - sortie * 0.35);
        });
      });
    }
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [videos.length]);

  // Pagination infinie cléset : même tri que le serveur (rang_auteur, score,
  // id), sans OFFSET qui devient coûteux et instable quand le feed évolue.
  useEffect(() => {
    if (fin || chargementRef.current || active < videos.length - 3) return;
    chargementRef.current = true;
    const filter = feedCursorFilter(videos.at(-1));
    if (!filter) {
      chargementRef.current = false;
      return;
    }
    supabaseBrowser()
      .from("videos_feed")
      .select("*")
      .order("rang_auteur", { ascending: true })
      .order("score", { ascending: false })
      .order("id", { ascending: true })
      .or(filter)
      .limit(PAGE)
      .then(async ({ data, error }) => {
        chargementRef.current = false;
        if (error) return; // on ne conclut pas « fin » : retentera au prochain passage
        let nouvelles = (data ?? []) as FeedVideo[];
        if (nouvelles.length < PAGE) setFin(true);
        if (nouvelles.length === 0) return;
        // Même traitement que le serveur : légende et référence traduites.
        if (locale !== "fr") {
          const { data: traductions } = await supabaseBrowser()
            .from("video_translations")
            .select("video_id, caption, verse_ref, storage_path, thumb_path")
            .eq("lang", locale)
            .in("video_id", nouvelles.map((v) => v.id));
          const parId = new Map((traductions ?? []).map((t) => [t.video_id, t]));
          nouvelles = nouvelles.map((v) => {
            const t = parId.get(v.id);
            return t
              ? {
                  ...v,
                  caption: t.caption ?? v.caption,
                  verse_ref: t.verse_ref ?? v.verse_ref,
                  storage_path: t.storage_path ?? v.storage_path,
                  thumb_path: t.thumb_path ?? v.thumb_path,
                }
              : v;
          });
        }
        nouvelles = await signerMedias(nouvelles);
        setVideos((prev) => {
          const vus = new Set(prev.map((v) => v.id));
          return [...prev, ...nouvelles.filter((v) => !vus.has(v.id))];
        });
      });
  }, [active, videos, fin, locale]);

  // Flèches clavier.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (ouverte) return; // le panneau commentaires garde le clavier
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      container.scrollBy({
        top: e.key === "ArrowDown" ? container.clientHeight : -container.clientHeight,
        behavior: "smooth",
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouverte]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  /** Tap simple = pause ; double tap = amen + burst de cœur (façon TikTok).
   *  Le tap simple attend 260 ms pour laisser sa chance au second tap. */
  function tapVideo(v: FeedVideo, i: number) {
    if (i !== active) return;
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      setBurst(v.id);
      setTimeout(() => setBurst(null), 900);
      if (!me) {
        // Laisser le cœur s'animer avant d'inviter à rejoindre.
        setTimeout(() => router.push("/signup"), 450);
        return;
      }
      // Le double tap aime, il ne « désaime » jamais (convention TikTok).
      if (!amened.has(v.id)) amen(v);
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        setPaused((p) => !p);
      }, 260);
    }
  }

  function afficherToast(message: string, duree = 2200) {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      setAnnulable(null);
    }, duree);
  }

  const nbAmen = useCallback(
    (v: FeedVideo) => amenCounts[v.id] ?? v.amen_count,
    [amenCounts],
  );
  const nbPrieres = useCallback(
    (v: FeedVideo) => prayCounts[v.id] ?? v.pray_count,
    [prayCounts],
  );
  const nbCommentaires = useCallback(
    (v: FeedVideo) => commentCounts[v.id] ?? v.comment_count,
    [commentCounts],
  );

  function exigeCompte(): boolean {
    if (me) return false;
    router.push("/signup");
    return true;
  }

  async function amen(v: FeedVideo) {
    if (exigeCompte()) return;
    const avait = amened.has(v.id);
    setAmened((prev) => {
      const s = new Set(prev);
      if (avait) s.delete(v.id);
      else s.add(v.id);
      return s;
    });
    setAmenCounts((prev) => ({
      ...prev,
      [v.id]: Math.max(0, nbAmen(v) + (avait ? -1 : 1)),
    }));
    let pris = false;
    try {
      pris = Boolean((await toggleVideoAmen(v.id))?.ok);
    } catch {}
    if (!pris) {
      setAmened((prev) => {
        const s = new Set(prev);
        if (avait) s.add(v.id);
        else s.delete(v.id);
        return s;
      });
      setAmenCounts((prev) => ({ ...prev, [v.id]: nbAmen(v) }));
    }
  }

  async function prier(v: FeedVideo) {
    if (exigeCompte()) return;
    if (prie.has(v.id)) {
      afficherToast(m.video.dejaPrie);
      return;
    }
    setPrie((prev) => new Set(prev).add(v.id));
    setPrayCounts((prev) => ({ ...prev, [v.id]: nbPrieres(v) + 1 }));
    setHalo(v.id);
    setTimeout(() => setHalo(null), 1500);
    afficherToast(m.video.priereEnvoyee);
    let pris = false;
    try {
      pris = Boolean((await prayForVideo(v.id))?.ok);
    } catch {}
    if (!pris) {
      setPrie((prev) => {
        const s = new Set(prev);
        s.delete(v.id);
        return s;
      });
      setPrayCounts((prev) => ({ ...prev, [v.id]: nbPrieres(v) }));
      afficherToast(m.video.priereEchec);
    }
  }

  async function suivre(v: FeedVideo) {
    if (exigeCompte()) return;
    if (v.author_id === me!.id) return;
    const suivait = suivis.has(v.author_id);
    setSuivis((prev) => {
      const s = new Set(prev);
      if (suivait) s.delete(v.author_id);
      else s.add(v.author_id);
      return s;
    });
    let ok = false;
    try {
      ok = Boolean((await toggleFollow(v.author_id))?.ok);
    } catch {}
    if (!ok) {
      setSuivis((prev) => {
        const s = new Set(prev);
        if (suivait) s.add(v.author_id);
        else s.delete(v.author_id);
        return s;
      });
    } else if (!suivait) {
      afficherToast(m.video.tuSuis(pseudo(v.username ?? m.commun.frere)));
    }
  }

  async function partager(v: FeedVideo) {
    const url = `${window.location.origin}/?v=${v.id}`;
    const titre = v.caption || m.video.partageTitre;
    try {
      if (navigator.share) {
        await navigator.share({ title: titre, url });
      } else {
        await navigator.clipboard.writeText(url);
        setPartage(v.id);
        setTimeout(() => setPartage(null), 2000);
      }
    } catch {
      // partage annulé : rien à faire
    }
  }

  async function signalerAvecMotif(v: FeedVideo, categorie: ReportCategory) {
    setMotifsPour(null);
    setOptionsPour(null);
    if (exigeCompte()) return;
    if (signalee.has(v.id)) {
      afficherToast(m.video.signalementOk);
      return;
    }
    setSignalee((prev) => new Set(prev).add(v.id));
    try {
      const r = await reportVideo(v.id, categorie);
      afficherToast(r?.ok ? m.video.signalementOk : m.video.signalementEchec);
    } catch {
      afficherToast(m.video.signalementEchec);
    }
  }

  async function mettreADistance(v: FeedVideo, kind: BlockKind) {
    setOptionsPour(null);
    if (exigeCompte()) return;
    try {
      const r = await blockAuthor(v.author_id, kind);
      if (!r?.ok) {
        afficherToast(m.video.gesteEchec);
        return;
      }
      if (kind === "not_interested") {
        afficherToast(m.video.gesteOk);
        return;
      }
      // Retrait local immédiat, mémorisé avec les positions pour l'annulation.
      setVideos((prev) => {
        retraitRef.current = {
          authorId: v.author_id,
          entrees: prev
            .map((video, i) => ({ v: video, i }))
            .filter(({ v: video }) => video.author_id === v.author_id),
        };
        return prev.filter((video) => video.author_id !== v.author_id);
      });
      setAnnulable(v.author_id);
      afficherToast(m.video.gesteOk, 5000);
    } catch {
      afficherToast(m.video.gesteEchec);
    }
  }

  async function annulerRetrait() {
    const retrait = retraitRef.current;
    setAnnulable(null);
    if (!retrait) return;
    retraitRef.current = null;
    try {
      const r = await unblockAuthor(retrait.authorId);
      if (!r?.ok) {
        afficherToast(m.video.gesteEchec);
        return;
      }
      setVideos((prev) => {
        const suivant = [...prev];
        for (const { v, i } of retrait.entrees) {
          suivant.splice(Math.min(i, suivant.length), 0, v);
        }
        return suivant;
      });
      afficherToast(m.video.gesteAnnule);
    } catch {
      afficherToast(m.video.gesteEchec);
    }
  }

  async function ouvrirAmenateurs(v: FeedVideo) {
    if (!me) {
      exigeCompte();
      return;
    }
    setAmenOuverte(v);
    setAmenateurs([]);
    setChargeAmenateurs(true);
    const { data: lignes, error } = await supabaseBrowser()
      .from("video_amens")
      .select("user_id, profiles(username)")
      .eq("video_id", v.id)
      .limit(100);
    if (error) {
      setChargeAmenateurs(false);
      return;
    }
    setAmenateurs(
      (lignes ?? [])
        .map((ligne) => {
          const profil = Array.isArray(ligne.profiles) ? ligne.profiles[0] : ligne.profiles;
          return profil?.username ? { id: ligne.user_id, username: profil.username } : null;
        })
        .filter((p): p is { id: string; username: string } => Boolean(p)),
    );
    setChargeAmenateurs(false);
  }

  async function ouvrirCommentaires(v: FeedVideo) {
    const startedAt = performance.now();
    setOuverte(v);
    setCommentaires([]);
    if (!me) return; // l'anonyme voit l'invitation à se connecter
    setChargeCommentaires(true);
    const { data: lignes, error } = await supabaseBrowser()
      .from("video_comments")
      .select("id, body, created_at, author_id, profiles(username)")
      .eq("video_id", v.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      setChargeCommentaires(false);
      return;
    }
    setCommentaires(
      (lignes ?? []).map((c) => ({
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        username:
          (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.username ?? m.commun.disciple,
      })),
    );
    setChargeCommentaires(false);
    if (process.env.NODE_ENV !== "production") {
      console.debug("[perf] ouverture commentaires", {
        duréeMs: Math.round(performance.now() - startedAt),
        commentaires: lignes?.length ?? 0,
      });
    }
  }

  async function envoyerCommentaire(e: React.FormEvent) {
    e.preventDefault();
    if (!ouverte || envoiCommentaire) return;
    if (exigeCompte()) return;
    const texte = nouveauCommentaire.trim();
    if (!texte) return;
    setEnvoiCommentaire(true);
    try {
      const r = await addVideoComment(ouverte.id, texte);
      if (r?.ok && r.comment) {
        setCommentaires((prev) => [
          {
            id: r.comment.id,
            body: r.comment.body,
            created_at: r.comment.created_at,
            username: me!.username ?? m.commun.moi,
          },
          ...prev,
        ]);
        setCommentCounts((prev) => ({
          ...prev,
          [ouverte.id]: (prev[ouverte.id] ?? ouverte.comment_count) + 1,
        }));
        setNouveauCommentaire("");
      } else {
        afficherToast(m.video.commentaireRefuse);
      }
    } catch {
      afficherToast(m.video.commentaireRefuse);
    }
    setEnvoiCommentaire(false);
  }

  return (
    <div
      data-load-marker="selah-authenticated-feed-v1"
      className="fixed inset-0 overflow-hidden bg-black text-white"
    >
      {/* Barre haute */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-5 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/" className="pointer-events-auto flex items-center">
          <MotSelah taille={38} />
        </Link>
        <div className="pointer-events-auto flex items-center gap-3 sm:gap-4">
          <button
            onClick={basculerSon}
            aria-label={muted ? m.video.activerSon : m.video.couperSon}
            aria-pressed={!muted}
            title={muted ? m.video.activerSon : m.video.couperSon}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-black/60 backdrop-blur-xl transition hover:bg-white/15 sm:h-10 sm:w-10 ${
              !muted && !paused
                ? "border-white/25 text-white"
                : "border-rose-400/70 text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.65)]"
            }`}
          >
            {muted ? (
              <VolumeX className="h-5 w-5 stroke-[2.5]" />
            ) : (
              <Volume2 className="h-5 w-5 stroke-[2.5]" />
            )}
          </button>
          {me ? (
            <Link
              href="/videos"
              aria-label={m.video.publierVideoAudio}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500 p-[1px] shadow-lg shadow-amber-500/20 transition hover:scale-105"
            >
              <span className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xl">
                <Camera className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span>{m.commun.publier}</span>
              </span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xl transition hover:bg-white/20"
              >
                {m.auth.seConnecter}
              </Link>
              <Link
                href="/signup"
 className="btn-paradise rounded-full px-4 py-2 text-xs font-bold transition hover:scale-105"
              >
                {m.commun.rejoindre}
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Toast spirituel (« Prière envoyée ✨ ») */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-40 flex justify-center">
          <span className="glass-pill animate-toast-in flex items-center gap-3 rounded-full px-5 py-2 text-sm font-semibold text-amber-200 shadow-xl">
            {toast}
            {annulable && (
              <button
                onClick={annulerRetrait}
                className="pointer-events-auto rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/25"
              >
                {m.commun.annuler}
              </button>
            )}
          </span>
        </div>
      )}

      {/* Colonne de vidéos plein écran */}
      <div
        ref={containerRef}
        className="no-scrollbar h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll bg-slate-950"
      >
        {videos.map((v, i) => {
          const proche = Math.abs(i - active) <= FENETRE;
          const typeBadge =
            TYPE_STYLE[v.type] ?? { bg: "from-emerald-500 to-teal-600", icon: Sparkles };
          const typeLabel = m.types[v.type as keyof typeof m.types] ?? v.type;
          const BadgeIcon = typeBadge.icon;
          const aAmen = amened.has(v.id);
          const aPrie = prie.has(v.id);
          const suit = suivis.has(v.author_id);
          const estMoi = me?.id === v.author_id;
          const estAudio = isAudioStoragePath(v.storage_path);

          return (
            <section
              key={v.id}
              data-index={i}
              className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden bg-slate-950"
            >
              {estAudio ? (
                <div
                  className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b ${typeBadge.bg}`}
                  onClick={() => tapVideo(v, i)}
                >
                  {v.thumb_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- URL signée éphémère.
                    <img
                      src={v.thumb_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-25 blur-sm"
                    />
                  )}
                  <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-7 px-8 pb-44 text-center">
                    <span className="flex h-32 w-32 items-center justify-center rounded-full border border-white/30 bg-black/20 shadow-[0_0_80px_rgba(255,255,255,0.22)] backdrop-blur-xl">
                      <Music2 className="h-16 w-16 text-white" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">
                        Audio
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {m.video.sonOriginal(pseudo(v.username ?? m.commun.disciple))}
                      </p>
                    </div>
                    <audio
                      ref={(el) => {
                        mediaRefs.current[i] = el;
                      }}
                      src={proche ? (v.media_url ?? undefined) : undefined}
                      loop
                      controls
                      preload={proche ? "metadata" : "none"}
                      aria-label={m.video.sonOriginal(
                        pseudo(v.username ?? m.commun.disciple),
                      )}
                      className="w-full"
                      onClick={(event) => event.stopPropagation()}
                      onError={() => {
                        if (proche) setCassees((prev) => new Set(prev).add(v.id));
                      }}
                    />
                  </div>
                </div>
              ) : (
                <video
                  ref={(el) => {
                    mediaRefs.current[i] = el;
                  }}
                  src={proche ? (v.media_url ?? undefined) : undefined}
                  poster={v.thumb_url ?? undefined}
                  loop
                  playsInline
                  preload={proche ? "metadata" : "none"}
                  className="h-full w-full object-cover sm:object-contain"
                  onClick={() => tapVideo(v, i)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      tapVideo(v, i);
                    }
                  }}
                  role="button"
                  tabIndex={i === active ? 0 : -1}
                  aria-label={
                    paused && i === active ? m.video.reprendre : m.video.mettreEnPause
                  }
                  aria-pressed={paused && i === active}
                  onError={() => {
                    if (proche) setCassees((prev) => new Set(prev).add(v.id));
                  }}
                />
              )}

              {/* Voile dégradé bas uniquement : la vidéo respire en haut */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

              {burst === v.id && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                  <Heart className="animate-coeur-burst h-28 w-28 fill-rose-500 text-rose-500 drop-shadow-[0_0_30px_rgba(244,63,94,0.8)]" />
                </div>
              )}

              {cassees.has(v.id) && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
                  <span className="text-4xl">🎞️</span>
                  <p className="text-sm text-white/70">
                    {m.video.indisponible}
                  </p>
                </div>
              )}

              {paused && i === active && (
                <button
                  onClick={() => setPaused(false)}
                  aria-label={m.video.reprendre}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/20"
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white shadow-2xl backdrop-blur-2xl">
                    <Play className="h-10 w-10 translate-x-0.5 fill-white" />
                  </span>
                </button>
              )}

              {/* Infos bas-gauche */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-5 pb-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))] pt-20">
                <div
                  className={`max-w-[calc(100%-5rem)] space-y-3 text-start ${
                    i === active ? "animate-arrive" : ""
                  }`}
                >
                  <div>
                    <h3 className="text-[18px] font-bold tracking-tight text-white drop-shadow-md">
                      <bdi>@{v.username ?? m.commun.disciple}</bdi> ✨
                    </h3>
                    {v.caption && (
                      <p className="mt-1.5 line-clamp-3 text-[17px] leading-snug text-white drop-shadow">
                        {v.caption}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${typeBadge.bg} px-3 py-1.5 text-[13px] font-semibold text-white shadow-lg`}
                    >
                      <BadgeIcon className="h-4 w-4" />
                      <span>{typeLabel}</span>
                    </span>
                    {v.verse_ref && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-lg">
                        <BookOpen className="h-4 w-4" />
                        <span>{v.verse_ref}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex w-full items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.14] px-3.5 py-2.5 backdrop-blur-xl">
                    <Music2 className="h-4 w-4 shrink-0 text-amber-200" />
                    <bdi className="truncate text-sm text-white/95">
                      {m.video.sonOriginal(pseudo(v.username ?? m.commun.disciple))}
                    </bdi>
                  </div>
                </div>
              </div>

              {/* Rail d'actions droit */}
              <div
                className={`rail-verre absolute bottom-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))] end-3 z-20 flex w-[62px] flex-col items-center gap-2.5 rounded-[32px] py-2 md:w-[74px] md:gap-5 md:rounded-[40px] md:py-4 ${
                  i === active ? "animate-arrive" : ""
                }`}
              >
                {/* Avatar + Suivre */}
                <div className="relative mb-4 md:mb-5">
                  <div className="h-[46px] w-[46px] rounded-full bg-gradient-to-tr from-teal-400 to-cyan-200 p-[2px] shadow-[0_0_18px_rgba(45,212,191,0.55)] md:h-[54px] md:w-[54px]">
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-base font-bold text-amber-300">
                      {(v.username || "S")[0].toUpperCase()}
                    </span>
                  </div>
                  {!estMoi && (
                    <button
                      onClick={() => suivre(v)}
                      aria-label={
                        suit
                          ? m.video.nePlusSuivre(pseudo(v.username ?? m.commun.disciple))
                          : m.video.suivre(pseudo(v.username ?? m.commun.disciple))
                      }
                      className="absolute -bottom-6 left-1/2 flex h-[44px] w-[44px] -translate-x-1/2 items-center justify-center rounded-full transition hover:scale-110"
                    >
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-white shadow-md ${
                          suit ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      >
                        {suit ? (
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 stroke-[3]" />
                        )}
                      </span>
                    </button>
                  )}
                </div>

                {/* Amen (cœur) */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => amen(v)}
                    aria-label={m.video.direAmen}
                    className="group flex min-h-11 min-w-11 items-center justify-center"
                  >
                    <span className="tap-bounce flex items-center justify-center transition-all duration-300">
                      <Heart
                        className={`h-8 w-8 transition-transform md:h-10 md:w-10 ${
                          aAmen
                            ? "scale-110 fill-rose-500 text-rose-500 drop-shadow-[0_0_14px_rgba(244,63,94,0.85)]"
                            : "fill-rose-400/90 text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.55)]"
                        }`}
                      />
                    </span>
                  </button>
                  <button
                    onClick={() => ouvrirAmenateurs(v)}
                    aria-label={m.video.quiAditAmen}
                    className="min-h-7 min-w-11 text-[13px] font-bold text-white underline-offset-2 hover:underline md:text-[15px]"
                  >
                    {formatCompte(nbAmen(v))}
                  </button>
                </div>

                {/* Je prie pour toi (halo doré) */}
                <button
                  onClick={() => prier(v)}
                  aria-label={m.video.priePourToi}
                  className="group relative flex min-h-12 min-w-12 flex-col items-center"
                >
                  {halo === v.id && (
                    <span className="prayer-halo absolute -inset-2 rounded-full bg-amber-400/40 blur-md" />
                  )}
                  <span
                    className={`tap-bounce relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-300 md:h-16 md:w-16 ${
                      aPrie
                        ? "scale-105 border border-amber-400 bg-amber-500/35 shadow-[0_0_28px_8px_rgba(245,158,11,0.45)]"
                        : ""
                    }`}
                  >
                    <span className="text-[28px] leading-none drop-shadow-[0_0_12px_rgba(245,158,11,0.6)] md:text-[34px]">🙏</span>
                  </span>
                  <span className="mt-0.5 text-[13px] font-bold text-amber-300 drop-shadow md:mt-1 md:text-[15px]">
                    {formatCompte(nbPrieres(v))}
                  </span>
                </button>

                {/* Commentaires */}
                <button
                  onClick={() => ouvrirCommentaires(v)}
                  aria-label={m.video.voirCommentaires}
                  className="group flex min-h-11 min-w-11 flex-col items-center justify-center"
                >
                  <span className="tap-bounce flex items-center justify-center text-white transition">
                    <MessageCircle className="h-7 w-7 md:h-9 md:w-9" />
                  </span>
                  <span className="mt-0 text-[13px] font-bold drop-shadow md:mt-1 md:text-[15px]">
                    {formatCompte(nbCommentaires(v))}
                  </span>
                </button>

                {/* Partager */}
                <button
                  onClick={() => partager(v)}
                  aria-label={m.video.partager}
                  className="group flex min-h-11 min-w-11 flex-col items-center justify-center"
                >
                  <span className="tap-bounce flex items-center justify-center text-white transition">
                    <Share2 className="h-7 w-7 md:h-9 md:w-9" />
                  </span>
                  <span className="mt-0 max-w-[56px] truncate text-[9px] font-medium text-white/70 drop-shadow md:mt-1 md:max-w-none md:text-[11px]">
                    {partage === v.id ? m.video.copie : m.video.partager}
                  </span>
                </button>

                {/* Options : signaler, masquer, bloquer, voir moins (discret) */}
                <button
                  onClick={() => setOptionsPour(v)}
                  aria-label={m.video.options}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80 md:h-8 md:w-8"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>
            </section>
          );
        })}

        {videos.length === 0 && erreurInitiale && (
          <section className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 px-8 text-center">
            <span className="text-5xl">📡</span>
            <p className="text-xl font-bold">{m.video.feedErreur}</p>
            <p className="text-white/70">{m.video.feedErreurAide}</p>
            <button
              onClick={() => window.location.reload()}
 className="btn-paradise rounded-full px-8 py-3 font-semibold "
            >
              {m.commun.reessayer}
            </button>
          </section>
        )}

        {videos.length === 0 && !erreurInitiale && (
          <section className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 px-8 text-center">
            <Sparkles className="h-12 w-12 animate-bounce text-amber-400" />
            <p className="text-xl font-bold">{m.video.feedVide}</p>
            <p className="text-white/70">{m.video.feedVideAide}</p>
            <Link
              href={me ? "/videos" : "/signup"}
 className="btn-paradise rounded-full px-8 py-3 font-semibold "
            >
              {me ? m.video.partagerTemoignage : m.auth.rejoindreReveil}
            </Link>
          </section>
        )}
      </div>

      {/* Nav basse : pilule seule (pas de chips sur le feed plein écran) */}
      <FloatingPillNav chips={false} />

      {optionsPour && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-md"
          onClick={() => setOptionsPour(null)}
        >
          <div
            className="animate-sheet-up relative flex w-full flex-col rounded-t-3xl border-t border-white/20 bg-slate-900/90 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-center border-b border-white/10 pb-3">
              <span className="text-[17px] font-bold text-white">{m.video.options}</span>
              <button
                onClick={() => setOptionsPour(null)}
                aria-label={m.video.fermerOptions}
                className="absolute end-0 rounded-full bg-white/10 p-1.5 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1 py-3">
              <button
                onClick={() => {
                  const v = optionsPour;
                  setOptionsPour(null);
                  setMotifsPour(v);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition hover:bg-white/10"
              >
                <Flag className="h-5 w-5 shrink-0 text-white/70" />
                <span className="text-sm font-semibold text-white">{m.video.signaler}</span>
              </button>
              <button
                onClick={() => mettreADistance(optionsPour, "not_interested")}
                className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition hover:bg-white/10"
              >
                <VolumeX className="h-5 w-5 shrink-0 text-white/70" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-white">{m.video.moinsVoir}</span>
                  <span className="block text-xs text-white/50">{m.video.moinsVoirAide}</span>
                </span>
              </button>
              <button
                onClick={() => mettreADistance(optionsPour, "mute")}
                className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition hover:bg-white/10"
              >
                <ShieldOff className="h-5 w-5 shrink-0 text-white/70" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-white">
                    {m.video.masquerAuteur(pseudo(optionsPour.username ?? m.commun.frere))}
                  </span>
                  <span className="block text-xs text-white/50">{m.video.masquerAuteurAide}</span>
                </span>
              </button>
              <button
                onClick={() => mettreADistance(optionsPour, "block")}
                className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition hover:bg-white/10"
              >
                <X className="h-5 w-5 shrink-0 text-rose-300" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-rose-200">
                    {m.video.bloquerAuteur(pseudo(optionsPour.username ?? m.commun.frere))}
                  </span>
                  <span className="block text-xs text-white/50">{m.video.bloquerAuteurAide}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {motifsPour && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-md"
          onClick={() => setMotifsPour(null)}
        >
          <div
            className="animate-sheet-up relative flex max-h-[70vh] w-full flex-col rounded-t-3xl border-t border-white/20 bg-slate-900/90 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-center border-b border-white/10 pb-3">
              <span className="text-[17px] font-bold text-white">{m.video.choisirMotif}</span>
              <button
                onClick={() => setMotifsPour(null)}
                aria-label={m.video.fermerOptions}
                className="absolute end-0 rounded-full bg-white/10 p-1.5 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="no-scrollbar flex-1 space-y-1 overflow-y-auto py-3">
              {REPORT_CATEGORIES.map((categorie) => (
                <button
                  key={categorie}
                  onClick={() => signalerAvecMotif(motifsPour, categorie)}
                  className="flex min-h-11 w-full items-center rounded-2xl px-3 py-2.5 text-start text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {m.video.motifs[categorie]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {amenOuverte && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-md"
          onClick={() => setAmenOuverte(null)}
        >
          <div
            className="animate-sheet-up relative flex max-h-[60vh] w-full flex-col rounded-t-3xl border-t border-white/20 bg-slate-900/90 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-center border-b border-white/10 pb-3">
              <span className="text-[17px] font-bold text-white">{m.video.quiAditAmen}</span>
              <button
                onClick={() => setAmenOuverte(null)}
                aria-label={m.video.fermerAmens}
                className="absolute end-0 rounded-full bg-white/10 p-1.5 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto py-4">
              {chargeAmenateurs ? (
                <p className="py-6 text-center text-sm text-white/50">{m.commun.chargement}</p>
              ) : amenateurs.length === 0 ? (
                <p className="py-6 text-center text-sm text-white/50">{m.video.aucunAmen}</p>
              ) : (
                <div className="space-y-3">
                  {amenateurs.map((a) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/20 text-xs font-bold text-rose-200">
                        {a.username[0]?.toUpperCase() ?? "S"}
                      </span>
                      <bdi className="text-sm font-semibold text-white/90">@{a.username}</bdi>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panneau commentaires (glass sheet) */}
      {ouverte && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-md"
          onClick={() => setOuverte(null)}
        >
          <div
            className="animate-sheet-up relative flex max-h-[70vh] w-full flex-col rounded-t-3xl border-t border-white/20 bg-slate-900/90 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto mb-3 h-1 w-11 rounded-full bg-white/35" />
            <div className="relative flex items-center justify-center border-b border-white/10 pb-3">
              <span className="text-[17px] font-bold text-white">
                {m.video.commentaires(formatCompte(nbCommentaires(ouverte)))}
              </span>
              <button
                onClick={() => setOuverte(null)}
                aria-label={m.video.fermerCommentaires}
                className="absolute end-0 rounded-full bg-white/10 p-1.5 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto py-4">
              {!me && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <MessageCircle className="h-8 w-8 text-white/40" />
                  <p className="text-sm text-white/70">
                    {m.video.connecteToiCommentaires}
                  </p>
                  <Link
                    href="/signup"
 className="btn-paradise rounded-full px-6 py-2.5 text-sm font-semibold "
                  >
                    {m.auth.rejoindreReveil}
                  </Link>
                </div>
              )}
              {me && chargeCommentaires && (
                <p className="py-6 text-center text-sm text-white/50">{m.commun.chargement}</p>
              )}
              {me && !chargeCommentaires && commentaires.length === 0 && (
                <p className="py-6 text-center text-sm text-white/50">
                  {m.video.aucunCommentaire}
                </p>
              )}
              {commentaires.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/20 text-xs font-bold text-emerald-300">
                    {c.username[0]?.toUpperCase() ?? "S"}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <bdi className="text-xs font-bold text-white/90">@{c.username}</bdi>
                      <span className="text-[10px] text-white/40">{ageLabel(c.created_at, m)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs leading-normal text-white/80">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {me && (
              <form
                onSubmit={envoyerCommentaire}
                className="flex gap-2 border-t border-white/10 pt-2"
              >
                <input
                  value={nouveauCommentaire}
                  onChange={(e) => setNouveauCommentaire(e.target.value)}
                  maxLength={2000}
                  placeholder={m.video.ajouterCommentaire}
                  className="glass-input flex-1 rounded-full px-4 py-2.5 text-xs placeholder:text-white/40"
                />
                <button
                  disabled={envoiCommentaire || !nouveauCommentaire.trim()}
                  aria-label={m.video.envoyerCommentaire}
 className="btn-paradise flex items-center justify-center rounded-full px-4 text-xs font-semibold disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
