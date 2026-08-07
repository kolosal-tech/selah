"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  addVideoComment,
  prayForVideo,
  reportVideo,
  toggleFollow,
  toggleVideoAmen,
} from "@/app/actions";
import {
  BookOpen,
  Camera,
  Flag,
  Flame,
  Heart,
  HeartHandshake,
  MessageCircle,
  Music2,
  Play,
  Plus,
  Send,
  Share2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Check,
} from "lucide-react";
import { FloatingPillNav } from "./nav-components";

export type FeedVideo = {
  id: string;
  author_id: string;
  storage_path: string;
  thumb_path: string | null;
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

const TYPE_CONFIG: Record<
  string,
  { label: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  temoignage: { label: "Témoignage", bg: "from-amber-500 to-rose-500", icon: Flame },
  exhortation: { label: "Exhortation", bg: "from-emerald-500 to-teal-600", icon: Sparkles },
  priere: { label: "Prière", bg: "from-cyan-500 to-blue-600", icon: HeartHandshake },
  enseignement: { label: "Enseignement", bg: "from-blue-500 to-indigo-600", icon: BookOpen },
  louange: { label: "Louange", bg: "from-purple-500 to-pink-600", icon: Music2 },
};

const PAGE = 24;
/** Fenêtre de préchargement : seules les vidéos à ±2 de l'écran ont un src. */
const FENETRE = 2;
const CLE_SON = "selah:son-active";

function formatCompte(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
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

  // Panneau commentaires : chargé à l'ouverture depuis la base.
  const [ouverte, setOuverte] = useState<FeedVideo | null>(null);
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [chargeCommentaires, setChargeCommentaires] = useState(false);
  const [nouveauCommentaire, setNouveauCommentaire] = useState("");
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const chargementRef = useRef(false);
  const activeRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/`;

  // Choix de son mémorisé : muet par défaut (contrainte navigateur), mais si
  // l'utilisateur a déjà activé le son une fois, on le restaure dès le
  // premier rendu client.
  useEffect(() => {
    // Différé d'une frame : lu après l'hydratation, sans setState synchrone
    // dans l'effet (le serveur rend toujours muet).
    const t = requestAnimationFrame(() => {
      try {
        if (localStorage.getItem(CLE_SON) === "1") setMuted(false);
      } catch {
        // stockage indisponible (navigation privée stricte) : rester muet
      }
    });
    return () => cancelAnimationFrame(t);
  }, []);

  function basculerSon() {
    setMuted((m) => {
      try {
        localStorage.setItem(CLE_SON, m ? "1" : "0");
      } catch {}
      return !m;
    });
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
    videoRefs.current.forEach((v, i) => {
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
        videoRefs.current.forEach((vid) => {
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

  // Pagination infinie : même tri que le serveur (rang_auteur, score).
  useEffect(() => {
    if (fin || chargementRef.current || active < videos.length - 3) return;
    chargementRef.current = true;
    const depuis = videos.length;
    supabaseBrowser()
      .from("videos_feed")
      .select("*")
      .order("rang_auteur", { ascending: true })
      .order("score", { ascending: false })
      .range(depuis, depuis + PAGE - 1)
      .then(({ data, error }) => {
        chargementRef.current = false;
        if (error) return; // on ne conclut pas « fin » : retentera au prochain passage
        const nouvelles = (data ?? []) as FeedVideo[];
        if (nouvelles.length < PAGE) setFin(true);
        if (nouvelles.length > 0) {
          setVideos((prev) => {
            const vus = new Set(prev.map((v) => v.id));
            return [...prev, ...nouvelles.filter((v) => !vus.has(v.id))];
          });
        }
      });
  }, [active, videos.length, fin]);

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

  function afficherToast(message: string) {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
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
      afficherToast("Tu portes déjà cette vidéo dans la prière 🙏");
      return;
    }
    setPrie((prev) => new Set(prev).add(v.id));
    setPrayCounts((prev) => ({ ...prev, [v.id]: nbPrieres(v) + 1 }));
    setHalo(v.id);
    setTimeout(() => setHalo(null), 1500);
    afficherToast("✨ Prière envoyée ✨");
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
      afficherToast("La prière n'a pas pu être enregistrée");
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
      afficherToast(`Tu suis @${v.username ?? "ce frère"}`);
    }
  }

  async function partager(v: FeedVideo) {
    const url = `${window.location.origin}/?v=${v.id}`;
    const titre = v.caption || "Un témoignage sur Selah";
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

  async function signaler(v: FeedVideo) {
    if (exigeCompte()) return;
    if (signalee.has(v.id)) return;
    setSignalee((prev) => new Set(prev).add(v.id));
    try {
      const r = await reportVideo(v.id);
      afficherToast(r?.ok ? "Signalement transmis aux modérateurs" : "Signalement impossible");
    } catch {
      afficherToast("Signalement impossible");
    }
  }

  async function ouvrirCommentaires(v: FeedVideo) {
    setOuverte(v);
    setCommentaires([]);
    if (!me) return; // l'anonyme voit l'invitation à se connecter
    setChargeCommentaires(true);
    const { data } = await supabaseBrowser()
      .from("video_comments")
      .select("id, body, created_at, profiles!video_comments_author_id_fkey(username)")
      .eq("video_id", v.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setCommentaires(
      (data ?? []).map((c) => ({
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        username:
          (c.profiles as unknown as { username?: string } | null)?.username ?? "disciple",
      })),
    );
    setChargeCommentaires(false);
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
            username: me!.username ?? "moi",
          },
          ...prev,
        ]);
        setCommentCounts((prev) => ({
          ...prev,
          [ouverte.id]: nbCommentaires(ouverte) + 1,
        }));
        setNouveauCommentaire("");
      } else {
        afficherToast("Commentaire refusé");
      }
    } catch {
      afficherToast("Commentaire refusé");
    }
    setEnvoiCommentaire(false);
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {/* Barre haute */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-5 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/" className="pointer-events-auto flex items-center">
          <span className="text-[28px] font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            Selah
          </span>
        </Link>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={basculerSon}
            aria-label={muted ? "Activer le son" : "Couper le son"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/20"
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          {me ? (
            <Link
              href="/videos"
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500 p-[1px] shadow-lg shadow-amber-500/20 transition hover:scale-105"
            >
              <span className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xl">
                <Camera className="h-4 w-4 text-amber-400" />
                <span>Témoigner</span>
              </span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xl transition hover:bg-white/20"
              >
                Se connecter
              </Link>
              <Link
                href="/signup"
 className="btn-paradise rounded-full px-4 py-2 text-xs font-bold transition hover:scale-105"
              >
                Rejoindre
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Toast spirituel (« Prière envoyée ✨ ») */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-40 flex justify-center">
          <span className="glass-pill animate-toast-in rounded-full px-5 py-2 text-sm font-semibold text-amber-200 shadow-xl">
            {toast}
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
            TYPE_CONFIG[v.type] ?? {
              label: v.type,
              bg: "from-emerald-500 to-teal-600",
              icon: Sparkles,
            };
          const BadgeIcon = typeBadge.icon;
          const aAmen = amened.has(v.id);
          const aPrie = prie.has(v.id);
          const suit = suivis.has(v.author_id);
          const estMoi = me?.id === v.author_id;

          return (
            <section
              key={v.id}
              data-index={i}
              className="relative flex h-[100dvh] w-full snap-start snap-always items-center justify-center overflow-hidden bg-slate-950"
            >
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={proche ? base + v.storage_path : undefined}
                poster={v.thumb_path ? base + v.thumb_path : undefined}
                loop
                playsInline
                preload={proche ? "metadata" : "none"}
                className="h-full w-full object-cover sm:object-contain"
                onClick={() => tapVideo(v, i)}
                onError={() => {
                  if (proche) setCassees((prev) => new Set(prev).add(v.id));
                }}
              />

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
                    Vidéo indisponible — continue de faire défiler.
                  </p>
                </div>
              )}

              {paused && i === active && (
                <button
                  onClick={() => setPaused(false)}
                  aria-label="Reprendre la lecture"
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
                  className={`max-w-[calc(100%-5rem)] space-y-3 ${
                    i === active ? "animate-arrive" : ""
                  }`}
                >
                  <div>
                    <h3 className="text-[18px] font-bold tracking-tight text-white drop-shadow-md">
                      @{v.username ?? "disciple"} ✨
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
                      <span>{typeBadge.label}</span>
                    </span>
                    {v.verse_ref && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-lg">
                        <BookOpen className="h-4 w-4" />
                        <span>{v.verse_ref}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex w-[calc(100%+4.5rem)] items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.14] px-3.5 py-2.5 backdrop-blur-xl">
                    <Music2 className="h-4 w-4 shrink-0 text-amber-200" />
                    <span className="truncate text-sm text-white/95">
                      Son original — @{v.username ?? "disciple"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rail d'actions droit */}
              <div
                className={`rail-verre absolute bottom-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))] right-3 z-20 flex w-[74px] flex-col items-center gap-5 rounded-[40px] py-4 ${
                  i === active ? "animate-arrive" : ""
                }`}
              >
                {/* Avatar + Suivre */}
                <div className="relative mb-1">
                  <div className="h-[54px] w-[54px] rounded-full bg-gradient-to-tr from-teal-400 to-cyan-200 p-[2px] shadow-[0_0_18px_rgba(45,212,191,0.55)]">
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-base font-bold text-amber-300">
                      {(v.username || "S")[0].toUpperCase()}
                    </span>
                  </div>
                  {!estMoi && (
                    <button
                      onClick={() => suivre(v)}
                      aria-label={suit ? `Ne plus suivre @${v.username}` : `Suivre @${v.username}`}
                      className={`absolute -bottom-2 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-md transition hover:scale-110 ${
                        suit ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    >
                      {suit ? (
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 stroke-[3]" />
                      )}
                    </button>
                  )}
                </div>

                {/* Amen (cœur) */}
                <button
                  onClick={() => amen(v)}
                  aria-label="Dire amen"
                  className="group flex flex-col items-center"
                >
                  <span className="tap-bounce flex items-center justify-center transition-all duration-300">
                    <Heart
                      className={`h-10 w-10 transition-transform ${
                        aAmen
                          ? "scale-110 fill-rose-500 text-rose-500 drop-shadow-[0_0_14px_rgba(244,63,94,0.85)]"
                          : "fill-rose-400/90 text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.55)]"
                      }`}
                    />
                  </span>
                  <span className="mt-1 text-[15px] font-bold drop-shadow">
                    {formatCompte(nbAmen(v))}
                  </span>
                </button>

                {/* Je prie pour toi (halo doré) */}
                <button
                  onClick={() => prier(v)}
                  aria-label="Je prie pour toi maintenant"
                  className="group relative flex flex-col items-center"
                >
                  {halo === v.id && (
                    <span className="prayer-halo absolute -inset-2 rounded-full bg-amber-400/40 blur-md" />
                  )}
                  <span
                    className={`tap-bounce relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
                      aPrie
                        ? "scale-105 border border-amber-400 bg-amber-500/35 shadow-[0_0_28px_8px_rgba(245,158,11,0.45)]"
                        : ""
                    }`}
                  >
                    <span className="text-[34px] leading-none drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]">🙏</span>
                  </span>
                  <span className="mt-1 text-[15px] font-bold text-amber-300 drop-shadow">
                    {formatCompte(nbPrieres(v))}
                  </span>
                </button>

                {/* Commentaires */}
                <button
                  onClick={() => ouvrirCommentaires(v)}
                  aria-label="Voir les commentaires"
                  className="group flex flex-col items-center"
                >
                  <span className="tap-bounce flex items-center justify-center text-white transition">
                    <MessageCircle className="h-9 w-9" />
                  </span>
                  <span className="mt-1 text-[15px] font-bold drop-shadow">
                    {formatCompte(nbCommentaires(v))}
                  </span>
                </button>

                {/* Partager */}
                <button
                  onClick={() => partager(v)}
                  aria-label="Partager"
                  className="group flex flex-col items-center"
                >
                  <span className="tap-bounce flex items-center justify-center text-white transition">
                    <Share2 className="h-9 w-9" />
                  </span>
                  <span className="mt-1 text-[11px] font-medium text-white/70 drop-shadow">
                    {partage === v.id ? "Copié !" : "Partager"}
                  </span>
                </button>

                {/* Signaler (discret) */}
                <button
                  onClick={() => signaler(v)}
                  aria-label="Signaler cette vidéo"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                >
                  <Flag className={`h-4 w-4 ${signalee.has(v.id) ? "fill-white/40" : ""}`} />
                </button>
              </div>
            </section>
          );
        })}

        {videos.length === 0 && erreurInitiale && (
          <section className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 px-8 text-center">
            <span className="text-5xl">📡</span>
            <p className="text-xl font-bold">Le feed n&apos;a pas pu charger.</p>
            <p className="text-white/70">Vérifie ta connexion, puis réessaie.</p>
            <button
              onClick={() => window.location.reload()}
 className="btn-paradise rounded-full px-8 py-3 font-semibold "
            >
              Réessayer
            </button>
          </section>
        )}

        {videos.length === 0 && !erreurInitiale && (
          <section className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950 px-8 text-center">
            <Sparkles className="h-12 w-12 animate-bounce text-amber-400" />
            <p className="text-xl font-bold">Aucune vidéo pour l&apos;instant.</p>
            <p className="text-white/70">
              Sois le premier à raconter ce que Dieu a fait — une minute, face caméra.
            </p>
            <Link
              href={me ? "/videos" : "/signup"}
 className="btn-paradise rounded-full px-8 py-3 font-semibold "
            >
              {me ? "Partager un témoignage" : "Rejoindre le Réveil"}
            </Link>
          </section>
        )}
      </div>

      {/* Nav basse : pilule seule (pas de chips sur le feed plein écran) */}
      <FloatingPillNav chips={false} />

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
                Commentaires ({formatCompte(nbCommentaires(ouverte))})
              </span>
              <button
                onClick={() => setOuverte(null)}
                aria-label="Fermer les commentaires"
                className="absolute right-0 rounded-full bg-white/10 p-1.5 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto py-4">
              {!me && (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <MessageCircle className="h-8 w-8 text-white/40" />
                  <p className="text-sm text-white/70">
                    Connecte-toi pour lire et écrire les commentaires.
                  </p>
                  <Link
                    href="/signup"
 className="btn-paradise rounded-full px-6 py-2.5 text-sm font-semibold "
                  >
                    Rejoindre le Réveil
                  </Link>
                </div>
              )}
              {me && chargeCommentaires && (
                <p className="py-6 text-center text-sm text-white/50">Chargement…</p>
              )}
              {me && !chargeCommentaires && commentaires.length === 0 && (
                <p className="py-6 text-center text-sm text-white/50">
                  Aucun commentaire — sois le premier à encourager. 🙌
                </p>
              )}
              {commentaires.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/20 text-xs font-bold text-emerald-300">
                    {c.username[0]?.toUpperCase() ?? "S"}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white/90">@{c.username}</span>
                      <span className="text-[10px] text-white/40">{ageLabel(c.created_at)}</span>
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
                  placeholder="Ajouter un commentaire…"
                  className="glass-input flex-1 rounded-full px-4 py-2.5 text-xs placeholder:text-white/40"
                />
                <button
                  disabled={envoiCommentaire || !nouveauCommentaire.trim()}
                  aria-label="Envoyer le commentaire"
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
