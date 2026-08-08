"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Fond d'ambiance « Paradis » — une photographie cinématique par univers de
 * l'application, sous voiles sombres.
 *
 * Trois exigences tenues ici :
 *   1. lisibilité — les voiles ramènent la luminance sous le texte blanc à un
 *      niveau où le contraste reste conforme, quelle que soit l'image ;
 *   2. mode Lite — en 2G ou avec l'économiseur de données activé, aucune image
 *      n'est chargée : le dégradé du layout suffit (pilier « zones à très
 *      faible connexion ») ;
 *   3. sobriété — la dérive lente s'arrête si le système demande de réduire
 *      les animations.
 */

export type NomFond =
  | "aube"
  | "priere"
  | "chambre-haute"
  | "monde"
  | "sabbat"
  | "assemblee";

/** Route → fond. `null` = pas d'image (la vidéo occupe déjà tout l'écran). */
function fondPourRoute(pathname: string): NomFond | null {
  if (pathname === "/" || pathname === "/decouvrir") return null;
  if (pathname.startsWith("/prayer")) return "priere";
  if (pathname.startsWith("/rooms")) return "chambre-haute";
  if (pathname.startsWith("/moderation")) return "chambre-haute";
  if (pathname.startsWith("/map")) return "monde";
  if (pathname.startsWith("/pastor")) return "monde";
  if (pathname.startsWith("/sabbath")) return "sabbat";
  if (pathname.startsWith("/hors-ligne")) return "sabbat";
  if (pathname.startsWith("/churches")) return "assemblee";
  if (pathname.startsWith("/login")) return "assemblee";
  if (pathname.startsWith("/signup")) return "assemblee";
  return "aube"; // /feed, /challenges, /mentorship, /videos…
}

type Connexion = { saveData?: boolean; effectiveType?: string; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void };

function connexion(): Connexion | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: Connexion }).connection;
}

/** Faux quand le navigateur signale une connexion coûteuse ou très lente. */
function lireAutorisation(): boolean {
  const c = connexion();
  if (!c) return true;
  if (c.saveData) return false;
  return c.effectiveType !== "slow-2g" && c.effectiveType !== "2g";
}

function sAbonnerConnexion(rappel: () => void): () => void {
  const c = connexion();
  c?.addEventListener?.("change", rappel);
  return () => c?.removeEventListener?.("change", rappel);
}

/**
 * Enveloppe le contenu de l'application : pose la couche photographique
 * derrière, et marque le conteneur (`data-fond`) pour que les styles sachent
 * qu'une image est présente. Le marqueur est rendu par React plutôt que posé
 * sur `<html>` : React possède `<html>` et effacerait un attribut externe au
 * premier rendu suivant.
 */
export function FondAmbiance({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const nom = fondPourRoute(pathname ?? "/");

  // Rendu serveur : pas d'image (le serveur ignore la qualité du lien).
  // Le client tranche à l'hydratation et re-tranche si le réseau change.
  const autorise = useSyncExternalStore(sAbonnerConnexion, lireAutorisation, () => false);
  const monte = Boolean(nom) && autorise;

  return (
    <>
      {monte && nom ? <CouchePhoto nom={nom} /> : null}
      <div className="relative min-h-full">{children}</div>
    </>
  );
}

function CouchePhoto({ nom }: { nom: NomFond }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* <img> délibéré, pas next/image : les WebP sont déjà encodés et
          dimensionnés à la construction (73 Ko en 1920 px), et les faire
          repasser par l'optimiseur d'images ajouterait un coût facturé sans
          gain de poids. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={nom}
        src={`/fonds/${nom}.webp`}
        srcSet={`/fonds/${nom}@1080.webp 1080w, /fonds/${nom}.webp 1920w`}
        sizes="100vw"
        alt=""
        decoding="async"
        fetchPriority="low"
        className="fond-image absolute inset-0 h-full w-full object-cover"
      />
      {/* Voile principal : assombrit surtout le haut et le bas, là où se
          posent l'en-tête de verre et la barre de navigation. */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/62 via-slate-950/28 to-slate-950/76" />
      {/* Teinte froide unifiante : toutes les pages restent de la même famille
          chromatique même si les photos diffèrent. */}
      <div className="absolute inset-0 bg-teal-950/15 mix-blend-multiply" />
      {/* Halos de la DA, conservés par-dessus la photo. */}
      <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-amber-500/12 blur-[120px]" />
      <div className="absolute bottom-1/3 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/12 blur-[100px]" />
    </div>
  );
}
