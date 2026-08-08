export default function HorsLigne() {
  return (
    <main className="animate-arrive mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="text-6xl">📡</div>
      <h1 className="text-2xl font-bold text-gradient-gold">Pas de réseau</h1>
      <p className="text-white/75">
        Selah a besoin d&apos;une connexion pour afficher le fil et la prière en
        direct. Ton contenu t&apos;attend dès le retour du réseau.
      </p>
      <p className="glass-card p-5 italic text-white/85">
        « Ceux qui se confient en l&apos;Éternel renouvellent leur force. »
        — Ésaïe 40:31
      </p>
      <p className="text-sm text-white/70">
        Profites-en : prie sans écran. C&apos;est aussi ça, Selah.
      </p>
    </main>
  );
}
