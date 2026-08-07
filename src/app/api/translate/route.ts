import { NextResponse } from "next/server";

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
  if (!text || !target) {
    return NextResponse.json({ error: "text et target requis" }, { status: 400 });
  }

  const url = process.env.TRANSLATE_API_URL;
  const key = process.env.TRANSLATE_API_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "traduction non configurée", original: text },
      { status: 501 },
    );
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ text, target }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "fournisseur en échec", original: text }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json({ translated: data.translated ?? text });
}
