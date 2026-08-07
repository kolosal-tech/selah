import Link from "next/link";

const piliers = [
  ["🙏", "Prière au centre", "« Je prie pour toi maintenant » : un clic, un compteur mondial, une communion réelle."],
  ["🔥", "Témoignages", "Récits qui bouleversent, exhortations et enseignements courts."],
  ["🌍", "Sans barrière de langue", "Carte d'intercession mondiale, communion entre continents."],
  ["🕊️", "Mode Sabbat", "24 h de déconnexion volontaire pour te consacrer à Dieu hors ligne."],
];

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-amber-600">
          Réveil mondial
        </p>
        <h1 className="mt-3 text-6xl font-bold tracking-tight text-stone-900">
          Selah
        </h1>
        <p className="mt-4 text-lg text-stone-600">
          Pause. Médite. Puis rejoins l&apos;Église mondiale qui prie, témoigne
          et adore — ensemble, en temps réel.
        </p>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        {piliers.map(([icon, titre, texte]) => (
          <div
            key={titre}
            className="rounded-2xl border border-amber-200 bg-white p-5 text-left shadow-sm"
          >
            <div className="text-2xl">{icon}</div>
            <h2 className="mt-2 font-semibold text-stone-900">{titre}</h2>
            <p className="mt-1 text-sm text-stone-600">{texte}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-full bg-amber-600 px-8 py-3 font-semibold text-white shadow hover:bg-amber-700"
        >
          Rejoindre le Réveil
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-amber-600 px-8 py-3 font-semibold text-amber-700 hover:bg-amber-100"
        >
          Se connecter
        </Link>
      </div>
      <p className="text-xs text-stone-400">
        « Que tout ce qui respire loue l&apos;Éternel ! » — Psaume 150:6
      </p>
    </main>
  );
}
