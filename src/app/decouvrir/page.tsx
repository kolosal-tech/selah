import Link from "next/link";
import { Sparkles, HeartHandshake, Flame, Globe2, Moon, Play } from "lucide-react";
import { getMessages } from "@/i18n/server";
import { LOCALES, NOM_LANGUE } from "@/i18n/config";
import { SelecteurLangue } from "@/app/selecteur-langue";

export default async function Decouvrir() {
  const m = await getMessages();
  const piliers = [
    { icon: HeartHandshake, titre: m.decouvrir.pilierPriereTitre, texte: m.decouvrir.pilierPriereTexte },
    { icon: Flame, titre: m.decouvrir.pilierTemoignagesTitre, texte: m.decouvrir.pilierTemoignagesTexte },
    { icon: Globe2, titre: m.decouvrir.pilierLangueTitre, texte: m.decouvrir.pilierLangueTexte },
    { icon: Moon, titre: m.decouvrir.pilierSabbatTitre, texte: m.decouvrir.pilierSabbatTexte },
  ];
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 py-16 text-center overflow-hidden bg-slate-950">
      {/* Vidéo d'ambiance en boucle (9:16 mobile, 16:9 desktop) sous voile sombre */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/90 z-10" />
        <div className="absolute inset-0 bg-emerald-950/20 z-10 mix-blend-overlay" />
        {/* Poster : la première image peinte est déjà celle de la DA, même si
            la vidéo (2,7 Mo) n'a pas encore un seul octet — et elle reste
            affichée si la lecture automatique est refusée. */}
        <video
          src="/landing/hero-vertical.mp4"
          poster="/fonds/assemblee@1080.webp"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          className="h-full w-full object-cover scale-105 sm:hidden"
        />
        <video
          src="/landing/hero-large.mp4"
          poster="/fonds/assemblee.webp"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          className="hidden h-full w-full object-cover scale-105 sm:block"
        />
      </div>

      <div className="absolute end-4 top-4 z-30">
        <SelecteurLangue />
      </div>

      <div className="relative z-20 max-w-3xl space-y-10">
        {/* Title Badge */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/30 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-300 shadow-lg">
            <Sparkles className="h-4 w-4" />
            <span>{m.decouvrir.badge}</span>
          </div>

        <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight text-gradient-gold drop-shadow-2xl">
            Selah
          </h1>

          <p className="mt-4 text-base sm:text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
            {m.decouvrir.slogan}
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="grid w-full gap-4 sm:grid-cols-2 text-start">
          {piliers.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.titre}
                className="glass-card glass-card-hover p-6 space-y-2 relative overflow-hidden group"
              >
                <div className="h-10 w-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-amber-300 transition">{p.titre}</h2>
                <p className="text-xs text-white/70 leading-relaxed">{p.texte}</p>
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-full btn-paradise px-8 py-3.5 text-sm font-bold hover:scale-105 transition"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>{m.decouvrir.regarder}</span>
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 transition"
          >
            <span>{m.auth.rejoindreReveil}</span>
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 px-8 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition"
          >
            <span>{m.auth.seConnecter}</span>
          </Link>
        </div>

        {/* La promesse « sans barrière de langue » ne se raconte pas : on
            montre les langues, chacune écrite dans sa propre écriture. Aucun
            texte à traduire, donc rien qui puisse dériver d'une langue à
            l'autre. */}
        <ul className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
          {LOCALES.map((l) => (
            <li
              key={l}
              lang={l}
              className="rounded-full border border-white/15 bg-white/[0.07] px-3 py-1 text-[13px] text-white/75 backdrop-blur-xl"
            >
              {NOM_LANGUE[l]}
            </li>
          ))}
        </ul>

        <p className="text-xs text-white/40 italic">{m.decouvrir.versetPied}</p>
      </div>
    </main>
  );
}
