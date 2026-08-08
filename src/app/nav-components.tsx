"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Home,
} from "lucide-react";

const NAV = [
  { href: "/feed", label: "Fil", icon: Rss },
  { href: "/", label: "Vidéos", icon: PlaySquare },
  { href: "/prayer", label: "Prière", icon: HeartHandshake },
  { href: "/rooms", label: "Direct", icon: Radio },
  { href: "/challenges", label: "Défis", icon: Trophy },
];

const NAV_PLUS = [
  { href: "/map", label: "Carte d'intercession", icon: Globe },
  { href: "/mentorship", label: "Paul & Timothée", icon: Users },
  { href: "/churches", label: "Annuaire des églises", icon: Building2 },
  { href: "/pastor", label: "Dashboard pasteur", icon: LayoutDashboard },
  { href: "/moderation", label: "Modération", icon: ShieldCheck },
  { href: "/sabbath", label: "Mode Sabbat 🕊️", icon: Moon },
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
 *  principaux), un chevron « retour » + un raccourci accueil, comme la vidéo. */
export function BarreRetour() {
  const pathname = usePathname();
  const router = useRouter();
  const estOnglet = NAV.some((n) => n.href === pathname);
  if (estOnglet) return null;

  const page = NAV_PLUS.find((n) => n.href === pathname);

  return (
    <div className="mb-4 flex items-center gap-3">
      <button
        onClick={() => router.back()}
        aria-label="Revenir en arrière"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      {page && (
        <span className="text-sm font-semibold text-white/80">{page.label}</span>
      )}
      <Link
        href="/"
        aria-label="Retour à l'accueil"
        className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
      >
        <Home className="h-[18px] w-[18px]" />
      </Link>
    </div>
  );
}

export function FloatingPillNav({ chips = true }: { chips?: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {/* Chips de sous-navigation : pages internes uniquement — sur le feed
          plein écran elles se superposeraient à la vidéo. */}
      {chips && (
        <div className="mb-6 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-2 whitespace-nowrap px-1">
            {NAV_PLUS.map((item) => {
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
                  <Icon className="h-3.5 w-3.5 text-amber-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Pilule de navigation flottante */}
      <nav className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-slate-950/70 px-6 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:gap-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center rounded-full px-3 py-1.5 transition-all duration-300 ${
                isActive ? "font-semibold text-amber-300" : "text-white/60 hover:text-white/90"
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
