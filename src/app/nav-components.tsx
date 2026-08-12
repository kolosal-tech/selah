"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Rss,
  PlaySquare,
  HeartHandshake,
  Radio,
  Trophy,
  Globe,
  Users,
  Building2,
  LayoutDashboard,
  Moon,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Home,
} from "lucide-react";
import { useMessages } from "@/i18n/client";
import type { Messages as M } from "@/i18n/messages";

const NAV = (m: M) => [
  { href: "/feed", label: m.nav.fil, icon: Rss },
  { href: "/", label: m.nav.videos, icon: PlaySquare },
  { href: "/prayer", label: m.nav.priere, icon: HeartHandshake },
  { href: "/rooms", label: m.nav.direct, icon: Radio },
  { href: "/challenges", label: m.nav.defis, icon: Trophy },
];

const NAV_PLUS = (m: M) => [
  { href: "/map", label: m.nav.carte, icon: Globe, iconClass: "text-violet-300" },
  { href: "/mentorship", label: m.nav.mentorat, icon: Users, iconClass: "text-sky-300" },
  { href: "/churches", label: m.nav.eglises, icon: Building2, iconClass: "text-emerald-300" },
  { href: "/pastor", label: m.nav.pasteur, icon: LayoutDashboard, iconClass: "text-indigo-300" },
  { href: "/moderation", label: m.nav.moderation, icon: ShieldCheck, iconClass: "text-rose-300" },
  { href: "/sabbath", label: m.nav.sabbat, icon: Moon, iconClass: "text-slate-200" },
];

/** Logotype « Selah » : blanc, italique fantaisiste, présent sur chaque écran. */
export function MotSelah({ taille = 34 }: { taille?: number }) {
  return (
    <span className="mot-selah" style={{ fontSize: taille }}>
      Selah
    </span>
  );
}

/** Barre de retour contextuelle : sur les écrans secondaires (hors onglets
 *  principaux), un chevron « retour » + un raccourci accueil. */
export function BarreRetour({ mentorshipVisible = true }: { mentorshipVisible?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const m = useMessages();
  const estOnglet = NAV(m).some((n) => n.href === pathname);
  if (estOnglet) return null;

  const page = NAV_PLUS(m).filter((n) => mentorshipVisible || n.href !== "/mentorship").find((n) => n.href === pathname);

  return (
    <div className="mb-4 flex items-center gap-3">
      <button
        onClick={() => router.back()}
        aria-label={m.commun.retour}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
      >
        <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
      </button>
      {page && (
        <span className="text-sm font-semibold text-white/80">{page.label}</span>
      )}
      <Link
        href="/"
        aria-label={m.commun.accueil}
        className="ms-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
      >
        <Home className="h-[18px] w-[18px]" />
      </Link>
    </div>
  );
}

export function FloatingPillNav({ chips = true, mentorshipVisible = true }: { chips?: boolean; mentorshipVisible?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const m = useMessages();
  const chipsRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    const element = chipsRef.current;
    if (!element) return;
    const updateOverflow = () => {
      setCanScrollPrev(element.scrollLeft > 2);
      setCanScrollNext(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };
    updateOverflow();
    element.addEventListener("scroll", updateOverflow, { passive: true });
    if (typeof ResizeObserver === "undefined") {
      return () => element.removeEventListener("scroll", updateOverflow);
    }
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", updateOverflow);
      observer.disconnect();
    };
  }, [m.nav.carte, m.nav.mentorat, m.nav.eglises, m.nav.pasteur, m.nav.moderation, m.nav.sabbat]);

  function scrollChips(direction: -1 | 1) {
    chipsRef.current?.scrollBy({ left: direction * 220, behavior: "smooth" });
  }

  return (
    <>
      {/* Chips de sous-navigation : pages internes uniquement — sur le feed
          plein écran elles se superposeraient à la vidéo. */}
      {chips && (
        <div className="relative mb-6 flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => scrollChips(-1)}
            disabled={!canScrollPrev}
            aria-label={m.nav.precedent}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:pointer-events-none disabled:opacity-30 md:flex"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
          <div ref={chipsRef} className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <div className="flex w-max min-w-full items-center gap-2 whitespace-nowrap px-1">
              {NAV_PLUS(m).filter((item) => mentorshipVisible || item.href !== "/mentorship").map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-lg shadow-emerald-500/10"
                        : "border border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${item.iconClass}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => scrollChips(1)}
            disabled={!canScrollNext}
            aria-label={m.nav.suivant}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:pointer-events-none disabled:opacity-30 md:flex"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* Pilule de navigation flottante */}
      <nav className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-[430px] items-center justify-between rounded-full border border-white/20 bg-slate-950/85 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {NAV(m).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              data-nav-link={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={(event) => {
                // `/` is la route du feed vidéo et sort du segment `(app)`.
                // Un push explicite évite qu'une navigation SPA reste sur
                // Profil alors que le lien est déjà marqué actif au toucher.
                if (item.href === "/" && pathname !== "/") {
                  event.preventDefault();
                  router.push("/");
                }
              }}
              className={`relative flex min-h-11 min-w-[52px] touch-manipulation flex-col items-center justify-center rounded-full px-2 py-1.5 transition-all duration-300 ${
                isActive ? "font-semibold text-amber-300" : "text-white/60 hover:text-white/90"
              } ${
                item.href === "/"
                  ? "order-first md:order-none"
                  : item.href === "/feed"
                    ? "md:order-first"
                    : ""
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-transform duration-300 ${
                  isActive ? "scale-110 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" : ""
                }`}
              />
              <span className="mt-0.5 text-[10px] tracking-tight">{item.label}</span>

              {isActive && (
                <span className="absolute -bottom-1 h-1 w-4 rounded-full bg-amber-400 shadow-[0_0_10px_#FBBF24]" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
