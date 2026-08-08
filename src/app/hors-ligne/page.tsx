import { getMessages } from "@/i18n/server";

export default async function HorsLigne() {
  const m = await getMessages();
  return (
    <main className="animate-arrive mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="text-6xl">📡</div>
      <h1 className="text-2xl font-bold text-gradient-gold">{m.horsLigne.titre}</h1>
      <p className="text-white/75">{m.horsLigne.texte}</p>
      <p className="glass-card p-5 italic text-white/85">{m.horsLigne.verset}</p>
      <p className="text-sm text-white/70">{m.horsLigne.conseil}</p>
    </main>
  );
}
