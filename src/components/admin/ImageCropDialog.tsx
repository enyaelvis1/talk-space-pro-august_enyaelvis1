import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crop, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FRAME_MAX_WIDTH = 520;
const FRAME_MAX_HEIGHT = 400;

const ASPECT_PRESETS = [
  { key: "free", label: "Original", ratio: null as number | null },
  { key: "16:9", label: "16:9 wide", ratio: 16 / 9 },
  { key: "3:2", label: "3:2 photo", ratio: 3 / 2 },
  { key: "4:3", label: "4:3", ratio: 4 / 3 },
  { key: "1:1", label: "1:1 square", ratio: 1 },
  { key: "4:5", label: "4:5 portrait", ratio: 4 / 5 },
  { key: "3:4", label: "3:4 card", ratio: 3 / 4 },
  { key: "1.91:1", label: "1.91:1 social", ratio: 1200 / 630 },
];

export type CropResult = { blob: Blob; width: number; height: number; type: string };

export function ImageCropDialog({
  open,
  onOpenChange,
  src,
  fileName = "image.jpg",
  initialAspect = "free",
  onCropped,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  fileName?: string;
  initialAspect?: string;
  onCropped: (file: File) => Promise<void> | void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aspectKey, setAspectKey] = useState(initialAspect);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [outputWidth, setOutputWidth] = useState(1600);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [viewport, setViewport] = useState({ w: 1024, h: 800 });

  useEffect(() => {
    const sync = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const naturalRatio = image ? image.naturalWidth / image.naturalHeight : 1;
  const aspect = useMemo(() => {
    const preset = ASPECT_PRESETS.find((p) => p.key === aspectKey);
    return preset?.ratio ?? naturalRatio;
  }, [aspectKey, naturalRatio]);

  // Fit the preview frame inside a box that also shrinks with the viewport, so the
  // Zoom / Export / Apply controls stay visible on short or narrow screens no matter
  // which preset is chosen (e.g. "Original" with a 1080x2400 source).
  const maxWidth = Math.min(FRAME_MAX_WIDTH, Math.max(220, viewport.w - 96));
  const maxHeight = Math.min(FRAME_MAX_HEIGHT, Math.max(180, Math.round(viewport.h * 0.4)));
  const frameWidth =
    aspect >= maxWidth / maxHeight ? maxWidth : Math.max(1, Math.round(maxHeight * aspect));
  const frameHeight = Math.max(1, Math.round(frameWidth / aspect));

  const baseScale = image
    ? Math.max(frameWidth / image.naturalWidth, frameHeight / image.naturalHeight)
    : 1;
  const scale = baseScale * zoom;
  const displayW = image ? image.naturalWidth * scale : 0;
  const displayH = image ? image.naturalHeight * scale : 0;

  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(frameWidth - displayW, x)),
      y: Math.min(0, Math.max(frameHeight - displayH, y)),
    }),
    [displayW, displayH, frameWidth, frameHeight],
  );

  const recenter = useCallback(() => {
    setOffset({ x: (frameWidth - displayW) / 2, y: (frameHeight - displayH) / 2 });
  }, [displayW, displayH, frameWidth, frameHeight]);

  // Load the source image whenever the dialog opens with a new src.
  useEffect(() => {
    if (!open || !src) return;
    let active = true;
    setImage(null);
    setLoadError(null);
    setZoom(1);
    setAspectKey(initialAspect);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!active) return;
      setImage(img);
      setOutputWidth(Math.min(2000, Math.max(400, img.naturalWidth)));
    };
    img.onerror = () => {
      if (active) setLoadError("This image could not be loaded for editing.");
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [open, src, initialAspect]);

  useEffect(() => {
    if (image) recenter();
  }, [image, recenter, aspectKey, zoom]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset(clamp(drag.ox + (e.clientX - drag.x), drag.oy + (e.clientY - drag.y)));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const outputHeight = Math.max(1, Math.round(outputWidth / aspect));

  async function apply() {
    if (!image) return;
    setBusy(true);
    try {
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = frameWidth / scale;
      const sh = frameHeight / scale;
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available in this browser.");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outputWidth, outputHeight);
      const isPng = /\.png$/i.test(fileName);
      const type = isPng ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, isPng ? undefined : 0.9),
      );
      if (!blob) throw new Error("Could not export the cropped image.");
      const base = fileName.replace(/\.[^.]+$/, "") || "image";
      const file = new File(
        [blob],
        `${base}-${outputWidth}x${outputHeight}.${isPng ? "png" : "jpg"}`,
        {
          type,
        },
      );
      await onCropped(file);
      onOpenChange(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Crop failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>Crop &amp; resize image</DialogTitle>
          <DialogDescription>
            Choose a shape, drag to reposition, zoom to frame it, then set the exported width.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {ASPECT_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant={aspectKey === preset.key ? "default" : "outline"}
                onClick={() => setAspectKey(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div
            data-crop-frame=""
            className="relative mx-auto touch-none overflow-hidden rounded-lg border border-border bg-muted"
            style={{ width: frameWidth, height: frameHeight, maxWidth: "100%" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {image ? (
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="absolute cursor-grab select-none active:cursor-grabbing"
                style={{
                  width: displayW,
                  height: displayH,
                  left: offset.x,
                  top: offset.y,
                  maxWidth: "none",
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {loadError ?? "Loading image…"}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 border border-white/40" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Zoom</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[zoom]}
                  min={1}
                  max={4}
                  step={0.01}
                  onValueChange={([v]) => setZoom(v ?? 1)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Reset"
                  onClick={() => {
                    setZoom(1);
                    recenter();
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="crop-output-width">Export width (px)</Label>
              <Input
                id="crop-output-width"
                type="number"
                min={200}
                max={4000}
                value={outputWidth}
                onChange={(e) =>
                  setOutputWidth(Math.min(4000, Math.max(200, Number(e.target.value) || 200)))
                }
              />
              <p className="text-xs text-muted-foreground">
                Exports {outputWidth}×{outputHeight}px
                {image ? ` · source ${image.naturalWidth}×${image.naturalHeight}px` : ""}
              </p>
            </div>
          </div>

          {loadError && image ? <p className="text-sm text-destructive">{loadError}</p> : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={!image || busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Crop className="mr-2 h-4 w-4" />
            )}
            Apply &amp; upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
