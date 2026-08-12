import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AccountActions } from "./account-actions";

type Session = {
  session_id: string;
  browser_family: string;
  device_type: string;
  last_seen_at: string;
  revoked_at: string | null;
};

export default async function AccountPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: deletion }, { data: sessions }] = await Promise.all([
    supabase.from("account_deletion_requests").select("execute_after, status").maybeSingle(),
    supabase.from("account_sessions").select("session_id, browser_family, device_type, last_seen_at, revoked_at").order("last_seen_at", { ascending: false }).limit(20),
  ]);
  const pending = deletion?.status === "pending" || deletion?.status === "processing";

  return <main className="flex flex-col gap-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Compte</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Données et sessions</h1>
      <p className="mt-1 text-sm text-white/60">L’export contient tes données Selah. Aucun historique d’adresse IP ni user-agent brut n’est conservé.</p>
    </div>
    <section className="glass-card flex flex-col gap-3 p-5">
      <h2 className="text-lg font-bold text-white">Exporter ou supprimer</h2>
      {pending && <p className="text-sm text-amber-100">Suppression planifiée après le {new Date(deletion.execute_after).toLocaleDateString()}. Elle peut être annulée jusqu’à son exécution.</p>}
      <AccountActions deletionPending={pending} />
    </section>
    <section className="glass-card flex flex-col gap-3 p-5">
      <h2 className="text-lg font-bold text-white">Appareils récents</h2>
      {(sessions ?? []).length === 0 ? <p className="text-sm text-white/60">Aucune session enregistrée pour le moment.</p> : <ul className="flex flex-col gap-2">{(sessions as Session[]).map((session) => <li key={session.session_id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">{session.browser_family} · {session.device_type} · {session.revoked_at ? "révoquée" : `vue le ${new Date(session.last_seen_at).toLocaleDateString()}`}</li>)}</ul>}
    </section>
    <Link href="/profile" className="self-start text-sm font-semibold text-amber-200 hover:text-amber-100">Retour au profil</Link>
  </main>;
}
