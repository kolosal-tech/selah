import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { estLocale } from "@/i18n/config";

const MAX_TEXT_LENGTH = 4_000;

/**
 * Traduction IA — interface stable, fournisseur branchable.
 * Sans TRANSLATE_API_URL/TRANSLATE_API_KEY configurés, renvoie 501 :
 * le client affiche alors le texte original (dégradation propre, jamais muette).
 */
export async function POST(request: Request) {
  const { text, target } = (await request.json().catch(() => ({}))) as {
    text?: string;
    target?: string;
  };
  const source = typeof text === "string" ? text.trim() : "";
  if (!source || typeof target !== "string" || !estLocale(target)) {
    return NextResponse.json({ error: "text et target requis" }, { status: 400 });
  }
  if (source.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "texte trop long" }, { status: 413 });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentification requise" }, { status: 401 });
  const { data: allowed, error: limitError } = await supabase.rpc("consume_rate_limit", {
    p_scope: "translation",
  });
  if (limitError || allowed !== true) {
    return NextResponse.json({ error: "quota temporairement atteint" }, { status: 429 });
  }

  const url = process.env.TRANSLATE_API_URL;
  const key = process.env.TRANSLATE_API_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "traduction non configurée", original: text },
      { status: 501 },
    );
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ text: source, target }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return NextResponse.json({ error: "fournisseur indisponible", original: source }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "fournisseur en échec", original: source }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json({ translated: data.translated ?? source });
}
