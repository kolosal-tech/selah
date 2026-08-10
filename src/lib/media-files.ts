export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
export const MAX_MEDIA_DURATION_SECONDS = 5 * 60;

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "audio/wav",
] as const;

export type MediaKind = "video" | "audio";

export type MediaFileDescriptor = {
  kind: MediaKind;
  mimeType: string;
  extension: string;
};

const AUDIO_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  weba: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
};

const VIDEO_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

const EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/webm": "weba",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

function normaliserMime(type: string): string {
  return type.toLowerCase().split(";", 1)[0].trim();
}

function extensionDuNom(name: string): string {
  return name.toLowerCase().split(/[?#]/, 1)[0].split(".").at(-1) ?? "";
}

export function decrireFichierMedia(
  fichier: Pick<File, "name" | "type">,
  attendu?: MediaKind,
): MediaFileDescriptor | null {
  const mimeDeclare = normaliserMime(fichier.type);
  const extension = extensionDuNom(fichier.name);
  const mimeParExtension = AUDIO_BY_EXTENSION[extension] ?? VIDEO_BY_EXTENSION[extension];
  const mimeType = EXTENSION_BY_MIME[mimeDeclare] ? mimeDeclare : mimeParExtension;
  if (!mimeType) return null;

  const kind: MediaKind = mimeType.startsWith("audio/") ? "audio" : "video";
  if (attendu && attendu !== kind) return null;

  return {
    kind,
    mimeType,
    extension: EXTENSION_BY_MIME[mimeType],
  };
}

export function extensionPourMime(type: string, kind: MediaKind): string | null {
  const mimeType = normaliserMime(type);
  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) return null;
  if (kind === "audio" && !mimeType.startsWith("audio/")) return null;
  if (kind === "video" && !mimeType.startsWith("video/")) return null;
  return extension;
}

export function isAudioStoragePath(storagePath: string): boolean {
  return ["mp3", "m4a", "weba", "ogg", "oga", "wav"].includes(
    extensionDuNom(storagePath),
  );
}
