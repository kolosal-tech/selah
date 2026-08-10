"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  DEFAULT_PREFERENCES,
  readAppPreferences,
  subscribeAppPreferences,
  updateAppPreference,
} from "@/lib/app-preferences";

const VOLUME_CIBLE = 0.32;

/**
 * Nappe d'ambiance optionnelle (pad instrumental bouclé, 32 s).
 *
 * Jamais d'autoplay : le son ne démarre que sur un geste explicite, et le
 * choix est mémorisé. `preload="none"` — les 258 Ko ne partent sur le réseau
 * que si l'utilisateur le demande, ce qui compte en zone à faible connexion.
 */
export function AmbianceSonore() {
  const ref = useRef<HTMLAudioElement>(null);
  const [lectureRefusee, setLectureRefusee] = useState(false);
  const preferences = useSyncExternalStore(subscribeAppPreferences, readAppPreferences, () => DEFAULT_PREFERENCES);
  const actif = preferences.ambience && !lectureRefusee;

  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;

    if (actif) {
      audio.volume = 0;
      // Une lecture refusée (politique navigateur) ne doit pas laisser le
      // bouton mentir sur l'état réel.
      audio.play().then(
        () => {
          const debut = performance.now();
          const monter = () => {
            const t = Math.min(1, (performance.now() - debut) / 1500);
            audio.volume = VOLUME_CIBLE * t;
            if (t < 1 && !audio.paused) requestAnimationFrame(monter);
          };
          requestAnimationFrame(monter);
        },
        () => setLectureRefusee(true),
      );
    } else {
      audio.pause();
    }
  }, [actif]);

  // Onglet caché : on suspend (batterie, et le son n'a plus d'objet).
  useEffect(() => {
    const onglet = () => {
      const audio = ref.current;
      if (!audio || !actif) return;
      if (document.hidden) audio.pause();
      else audio.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onglet);
    return () => document.removeEventListener("visibilitychange", onglet);
  }, [actif]);

  return (
    <>
      <audio ref={ref} src="/sons/ambiance-selah.m4a" loop preload="none" />
      <button
        type="button"
        onClick={() => {
          setLectureRefusee(false);
          updateAppPreference("ambience", !actif);
        }}
        aria-pressed={actif}
        title={actif ? "Couper l'ambiance sonore" : "Activer l'ambiance sonore"}
        className={`tap-bounce flex h-8 w-8 items-center justify-center rounded-full border transition ${
          actif
            ? "border-amber-400/50 bg-amber-500/20 text-amber-300"
            : "border-white/15 bg-white/5 text-white/50 hover:text-white/80"
        }`}
      >
        {actif ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        <span className="sr-only">
          {actif ? "Couper l'ambiance sonore" : "Activer l'ambiance sonore"}
        </span>
      </button>
    </>
  );
}
