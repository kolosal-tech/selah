"use client";

import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { publishVideo } from "@/app/actions";

const MAX_OCTETS = 50 * 1024 * 1024;
const TYPES_OK = ["video/mp4", "video/webm", "video/quicktime"];

/**
 * Le fichier part directement du navigateur vers Supabase Storage : il ne
 * transite jamais par le serveur Next, qui plafonne le corps des requêtes et
 * facturerait la bande passante deux fois. Le Server Action ne reçoit que le
 * chemin déposé.
 */
export function UploadForm({ userId }: { userId: string }) {
  const [etat, setEtat] = useState<"pret" | "envoi" | "erreur">("pret");
  const [message, setMessage] = useState("");
  const fichierRef = useRef<HTMLInputElement>(null);

  async function envoyer(formData: FormData) {
    const fichier = fichierRef.current?.files?.[0];
    if (!fichier) {
      setEtat("erreur");
      setMessage("Choisis une vidéo.");
      return;
    }
    if (!TYPES_OK.includes(fichier.type)) {
      setEtat("erreur");
      setMessage("Format accepté : MP4, WebM ou MOV.");
      return;
    }
    if (fichier.size > MAX_OCTETS) {
      setEtat("erreur");
      setMessage("Vidéo trop lourde (50 Mo maximum).");
      return;
    }

    setEtat("envoi");
    setMessage("Envoi en cours…");

    const extension = fichier.name.split(".").pop()?.toLowerCase() ?? "mp4";
    const chemin = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabaseBrowser()
      .storage.from("videos")
      .upload(chemin, fichier, { contentType: fichier.type });

    if (error) {
      setEtat("erreur");
      setMessage(`Envoi refusé : ${error.message}`);
      return;
    }

    formData.set("storage_path", chemin);
    formData.set("duration_s", "0");
    await publishVideo(formData);
    setEtat("pret");
    setMessage("Publiée. Gloire à Dieu !");
    if (fichierRef.current) fichierRef.current.value = "";
  }

  return (
    <form
      action={envoyer}
      className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
    >
      <input
        ref={fichierRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="text-sm"
      />
      <textarea
        name="caption"
        rows={2}
        placeholder="Ce que Dieu a fait…"
        className="resize-none rounded-lg border border-stone-200 p-3 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select name="type" className="rounded-lg border border-stone-200 p-2 text-sm">
          <option value="temoignage">🔥 Témoignage</option>
          <option value="exhortation">💬 Exhortation</option>
          <option value="enseignement">📖 Enseignement</option>
          <option value="louange">🎵 Louange</option>
        </select>
        <input
          name="verse_ref"
          placeholder="Verset"
          className="flex-1 rounded-lg border border-stone-200 p-2 text-sm"
        />
        <button
          disabled={etat === "envoi"}
          className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {etat === "envoi" ? "Envoi…" : "Publier"}
        </button>
      </div>
      {message && (
        <p
          className={
            etat === "erreur"
              ? "text-sm text-red-700"
              : "text-sm text-stone-500"
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}
