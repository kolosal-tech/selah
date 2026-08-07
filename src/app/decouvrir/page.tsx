import Link from "next/link";
import { Sparkles, HeartHandshake, Flame, Globe2, Moon, Play } from "lucide-react";

const piliers = [
  { icon: HeartHandshake, titre: "Prière au centre", texte: "« Je prie pour toi maintenant » : un clic, un compteur mondial, une communion réelle." },
  { icon: Flame, titre: "Témoignages", texte: "Récits qui bouleversent, exhortations et enseignements courts en format vidéo TikTok." },
  { icon: Globe2, titre: "Sans barrière de langue", texte: "Carte d'intercession mondiale, communion fraternelle entre continents." },
  { icon: Moon, titre: "Mode Sabbat", texte: "24 h de déconnexion volontaire pour te consacrer à Dieu en toute sérénité." },
];

export default function Decouvrir() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 py-16 text-center overflow-hidden bg-slate-950">
      {/* Vidéo d'ambiance en boucle (9:16 mobile, 16:9 desktop) sous voile sombre */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/90 z-10" />
        <div className="absolute inset-0 bg-emerald-950/20 z-10 mix-blend-overlay" />
        {/* Deux éléments : seul le visible du breakpoint est monté avec sa source,
            l'attribut media n'existant pas sur <source> hors <picture>. */}
        <video
          src="/landing/hero-vertical.mp4"
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
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          className="hidden h-full w-full object-cover scale-105 sm:block"
        />
      </div>

      <div className="relative z-20 max-w-3xl space-y-10">
        {/* Title Badge */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/30 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-300 shadow-lg">
            <Sparkles className="h-4 w-4" />
            <span>Réveil Mondial</span>
          </div>

          <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight text-gradient-gold drop-shadow-2xl">
            Selah
          </h1>

          <p className="mt-4 text-base sm:text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
            Pause. Médite. Puis rejoins l&apos;Église mondiale qui prie, témoigne et adore — ensemble, en temps réel.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="grid w-full gap-4 sm:grid-cols-2 text-left">
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
            <span>Regarder les témoignages</span>
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 transition"
          >
            <span>Rejoindre le Réveil</span>
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 px-8 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition"
          >
            <span>Se connecter</span>
          </Link>
        </div>

        <p className="text-xs text-white/40 italic">
          « Que tout ce qui respire loue l&apos;Éternel ! » — Psaume 150:6
        </p>
      </div>
    </main>
  );
}

