"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Move, RotateCcw, ZoomIn } from "lucide-react";
import { clamp, profilePhotoCrop } from "./profile-photo-crop";

type ProfilePhotoCropperProps = {
  file: File;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: (crop: { zoom: number; panX: number; panY: number }) => void;
};

type ImageSize = { width: number; height: number };

export function ProfilePhotoCropper({ file, disabled = false, onCancel, onConfirm }: ProfilePhotoCropperProps) {
  const headingId = useId();
  const descriptionId = useId();
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sourceUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => URL.revokeObjectURL(sourceUrl), [sourceUrl]);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  const crop = imageSize ? profilePhotoCrop({ width: imageSize.width, height: imageSize.height, zoom, panX, panY }) : null;
  const imageStyle = crop && imageSize ? {
    width: `${(imageSize.width / crop.width) * 100}%`,
    height: `${(imageSize.height / crop.height) * 100}%`,
    left: `${-(crop.x / crop.width) * 100}%`,
    top: `${-(crop.y / crop.height) * 100}%`,
  } : undefined;

  function reset() {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }

  function moveByPointer(clientX: number, clientY: number, rect: DOMRect) {
    if (!dragStart.current || !imageSize || !crop) return;
    const xDelta = ((clientX - dragStart.current.x) / rect.width) * 100;
    const yDelta = ((clientY - dragStart.current.y) / rect.height) * 100;
    const canMoveX = imageSize.width > crop.width;
    const canMoveY = imageSize.height > crop.height;
    setPanX(canMoveX ? clamp(dragStart.current.panX - xDelta, -100, 100) : 0);
    setPanY(canMoveY ? clamp(dragStart.current.panY - yDelta, -100, 100) : 0);
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !disabled) onCancel();
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"),
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="glass-card w-full max-w-md p-5 shadow-2xl">
        <h3 id={headingId} className="text-lg font-bold text-white">Cadre ta photo</h3>
        <p id={descriptionId} className="mt-1 text-sm text-white/70">Déplace l’image ou ajuste les curseurs avant de l’enregistrer.</p>
        <div
          className="relative mx-auto mt-5 aspect-square w-full max-w-xs touch-none overflow-hidden rounded-full border-2 border-amber-300/70 bg-black/30"
          onPointerDown={(event) => {
            if (disabled) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragStart.current = { x: event.clientX, y: event.clientY, panX, panY };
          }}
          onPointerMove={(event) => moveByPointer(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())}
          onPointerUp={() => { dragStart.current = null; }}
          onPointerCancel={() => { dragStart.current = null; }}
          aria-label="Aperçu de la zone recadrée. Fais glisser l’image pour la repositionner."
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sourceUrl}
            alt="Aperçu de la photo à recadrer"
            className="pointer-events-none absolute max-w-none select-none"
            style={imageStyle}
            onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          />
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-white" htmlFor={`${headingId}-zoom`}>
            <span className="flex items-center gap-2"><ZoomIn className="h-4 w-4" aria-hidden="true" />Zoom</span>
            <input id={`${headingId}-zoom`} className="mt-2 w-full accent-amber-300" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} disabled={disabled} />
          </label>
          <fieldset disabled={disabled} className="space-y-3">
            <legend className="flex items-center gap-2 text-sm font-medium text-white"><Move className="h-4 w-4" aria-hidden="true" />Position</legend>
            <label className="block text-xs text-white/75" htmlFor={`${headingId}-x`}>
              Horizontale
              <input id={`${headingId}-x`} aria-label="Position horizontale" className="mt-1 w-full accent-amber-300" type="range" min="-100" max="100" step="1" value={panX} onChange={(event) => setPanX(Number(event.target.value))} />
            </label>
            <label className="block text-xs text-white/75" htmlFor={`${headingId}-y`}>
              Verticale
              <input id={`${headingId}-y`} aria-label="Position verticale" className="mt-1 w-full accent-amber-300" type="range" min="-100" max="100" step="1" value={panY} onChange={(event) => setPanY(Number(event.target.value))} />
            </label>
          </fieldset>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50" onClick={reset} disabled={disabled}>
            <RotateCcw className="mr-1 inline h-4 w-4" aria-hidden="true" />Réinitialiser
          </button>
          <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50" onClick={onCancel} disabled={disabled}>Annuler</button>
          <button type="button" className="btn-paradise rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => onConfirm({ zoom, panX, panY })} disabled={disabled || !imageSize}>Enregistrer la photo</button>
        </div>
      </div>
    </div>
  );
}
