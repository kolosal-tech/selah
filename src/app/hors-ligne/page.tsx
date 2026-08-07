export default function HorsLigne() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="text-6xl">📡</div>
      <h1 className="text-2xl font-bold text-stone-900">Pas de réseau</h1>
      <p className="text-stone-600">
        Selah a besoin d&apos;une connexion pour afficher le fil et la prière en
        direct. Ton contenu t&apos;attend dès le retour du réseau.
      </p>
      <p className="rounded-2xl border border-amber-200 bg-white p-5 italic text-stone-700 shadow-sm">
        « Ceux qui se confient en l&apos;Éternel renouvellent leur force. »
        — Ésaïe 40:31
      </p>
      <p className="text-sm text-stone-500">
        Profites-en : prie sans écran. C&apos;est aussi ça, Selah.
      </p>
    </main>
  );
}
