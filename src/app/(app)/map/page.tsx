import { supabaseServer } from "@/lib/supabase/server";

const FLAGS: Record<string, string> = {};
function flag(cc: string) {
  if (!FLAGS[cc]) {
    FLAGS[cc] = cc
      .toUpperCase()
      .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  }
  return FLAGS[cc];
}

export default async function IntercessionMap() {
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("intercession_map")
    .select("*")
    .order("prayers_24h", { ascending: false });

  const total = (rows ?? []).reduce((s, r) => s + r.prayers_24h, 0);
  const max = Math.max(1, ...(rows ?? []).map((r) => r.prayers_24h));

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">
          Carte d&apos;intercession
        </h1>
        <p className="text-stone-600">
          <strong className="text-amber-700">{total}</strong> prières portées ces
          dernières 24 h à travers le monde.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {(rows ?? []).map((r) => (
          <div
            key={r.country}
            className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white p-3"
          >
            <span className="text-2xl">{flag(r.country)}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${(r.prayers_24h / max) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-sm font-semibold text-stone-700">
              {r.prayers_24h}
            </span>
          </div>
        ))}
        {(rows ?? []).length === 0 && (
          <p className="text-center text-stone-400">
            La carte s&apos;allumera dès la première prière. Va sur le mur de
            prière. 🌍
          </p>
        )}
      </div>
    </main>
  );
}
