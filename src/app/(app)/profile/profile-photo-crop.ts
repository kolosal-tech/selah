export const PROFILE_PHOTO_OUTPUT_SIZE = 1024;

export type ProfilePhotoCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CropOptions = {
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function profilePhotoCrop({ width, height, zoom, panX, panY }: CropOptions): ProfilePhotoCrop {
  const shortestSide = Math.min(width, height);
  const cropSide = shortestSide / clamp(zoom, 1, 3);
  const maxX = width - cropSide;
  const maxY = height - cropSide;

  return {
    x: maxX / 2 + (clamp(panX, -100, 100) / 100) * (maxX / 2),
    y: maxY / 2 + (clamp(panY, -100, 100) / 100) * (maxY / 2),
    width: cropSide,
    height: cropSide,
  };
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire l'image."));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossible de créer l'image recadrée."));
    }, type, type === "image/png" ? undefined : 0.92);
  });
}

export async function createCroppedProfilePhoto(file: File, options: Omit<CropOptions, "width" | "height">) {
  const image = await loadImage(file);
  const crop = profilePhotoCrop({ width: image.naturalWidth, height: image.naturalHeight, ...options });
  const outputSize = Math.min(PROFILE_PHOTO_OUTPUT_SIZE, Math.round(crop.width));
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas non disponible.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outputSize, outputSize);
  const blob = await canvasBlob(canvas, file.type);
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const stem = file.name.replace(/\.[^/.]+$/, "") || "photo-profil";
  return new File([blob], `${stem}.${extension}`, { type: file.type });
}
