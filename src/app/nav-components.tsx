"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                    : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20"
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

      {/* Floating glassmorphic bottom navigation pill */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 sm:gap-3 rounded-full bg-slate-950/70 backdrop-blur-2xl border border-white/20 px-6 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center px-3 py-1.5 rounded-full transition-all duration-300 ${
                isActive ? "text-amber-300 font-semibold" : "text-white/60 hover:text-white/90"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-transform duration-300 ${
                  isActive ? "scale-110 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" : ""
                }`}
              />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>

              {/* Glowing active pill indicator */}
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
