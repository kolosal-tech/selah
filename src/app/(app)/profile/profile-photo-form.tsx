"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { removeProfileAvatar, setProfileAvatar } from "@/app/actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useMessages } from "@/i18n/client";
import { createCroppedProfilePhoto } from "./profile-photo-crop";
import { ProfilePhotoCropper } from "./profile-photo-cropper";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export function ProfilePhotoForm({ currentUrl }: { currentUrl: string | null }) {
  const m = useMessages();
  const [preview, setPreview] = useState(currentUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectPreviewRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectPreviewRef.current) URL.revokeObjectURL(objectPreviewRef.current);
  }, []);

  function choisir(file: File | undefined) {
    if (!file || busy) return;
    setMessage(null);
    if (!TYPES.has(file.type) || file.size > MAX_BYTES) {
      setMessage(m.commun.photoErreur);
      return;
    }
    setSelectedFile(file);
  }

  async function enregistrerRecadrage(crop: { zoom: number; panX: number; panY: number }) {
    if (!selectedFile || busy) return;
    setBusy(true);
    setMessage(null);
    let file: File;
    try {
      file = await createCroppedProfilePhoto(selectedFile, crop);
    } catch {
      setMessage(m.commun.photoErreur);
      setBusy(false);
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage(m.commun.photoErreur);
      setBusy(false);
      return;
    }
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const chemin = `avatar-${crypto.randomUUID()}.${ext}`;
    const client = supabaseBrowser();
    const { data: auth } = await client.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setMessage(m.commun.photoErreur);
      setBusy(false);
      return;
    }
    const cheminProprietaire = `${userId}/${chemin}`;
    const { error: uploadError } = await client.storage
      .from("avatars")
      .upload(cheminProprietaire, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setMessage(m.commun.photoErreur);
      setBusy(false);
      return;
    }
    const saved = await setProfileAvatar(cheminProprietaire);
    if (!saved.ok) {
      setMessage(m.commun.photoErreur);
    } else {
      if (objectPreviewRef.current) URL.revokeObjectURL(objectPreviewRef.current);
      const objectPreview = URL.createObjectURL(file);
      objectPreviewRef.current = objectPreview;
      setPreview(objectPreview);
      setMessage(m.commun.photoEnregistree);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
    setBusy(false);
  }

  async function supprimer() {
    if (!preview || busy) return;
    if (!window.confirm(m.commun.confirmerSuppressionPhoto)) return;
    setBusy(true);
    setMessage(null);
    const result = await removeProfileAvatar();
    if (result.ok) {
      if (objectPreviewRef.current) URL.revokeObjectURL(objectPreviewRef.current);
      objectPreviewRef.current = null;
      setPreview(null);
      setMessage(m.commun.photoSupprimee);
    } else if (result.reason !== "absente") {
      setMessage(m.commun.photoSuppressionErreur);
    }
    setBusy(false);
  }

  function annulerRecadrage() {
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-amber-300/50 bg-white/10">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={m.commun.photoProfil} className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-9 w-9 text-white/45" aria-hidden="true" />
        )}
      </div>
      <label className="btn-paradise flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold">
        <Camera className="h-4 w-4" aria-hidden="true" />
        <span>{busy ? m.commun.chargement : m.commun.choisirPhoto}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => choisir(e.target.files?.[0])}
          disabled={busy}
        />
      </label>
      <p className="text-center text-xs text-white/50">{m.commun.photoAide}</p>
      {preview && !selectedFile && (
        <button
          type="button"
          onClick={() => void supprimer()}
          disabled={busy}
          className="min-h-11 rounded-full border border-rose-400/40 px-5 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15 disabled:opacity-50"
        >
          {m.commun.supprimerPhoto}
        </button>
      )}
      {message && <p className="text-sm text-amber-200" role="status">{message}</p>}
      {selectedFile && (
        <ProfilePhotoCropper
          file={selectedFile}
          disabled={busy}
          onCancel={annulerRecadrage}
          onConfirm={enregistrerRecadrage}
        />
      )}
    </div>
  );
}
