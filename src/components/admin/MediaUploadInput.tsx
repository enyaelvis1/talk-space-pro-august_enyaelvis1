import { useEffect, useRef, useState } from "react";
import { Crop, ImagePlus, Link as LinkIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signContentMediaUrl } from "@/lib/admin.functions";
import { ImageCropDialog } from "@/components/admin/ImageCropDialog";

const BUCKET = "content-media";

function slugifyName(name: string) {
  const dot = name.lastIndexOf(".");
  const base =
    (dot > 0 ? name.slice(0, dot) : name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "file";
  const ext =
    dot > 0
      ? name
          .slice(dot)
          .toLowerCase()
          .replace(/[^.a-z0-9]/g, "")
      : "";
  return `${base}${ext}`;
}

export type MediaUploadReturn = "path" | "publicUrl" | "signedUrl";

/**
 * Combined image field: paste a URL, OR upload a file from your device.
 * - returnAs="path" → onChange fires with `content-media/…` storage path (for
 *   fields like content_entries.featured_media_path).
 * - returnAs="signedUrl" → onChange fires with a long-lived signed URL
 *   (for fields like therapists.image_url that render directly on the site).
 */
export function MediaUploadInput({
  label = "Image",
  value,
  onChange,
  folder = "uploads",
  returnAs = "signedUrl",
  accept = "image/*",
  placeholder = "https://… or upload",
  helpText,
  previewable = true,
  cropAspect = "free",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  folder?: string;
  returnAs?: MediaUploadReturn;
  accept?: string;
  placeholder?: string;
  helpText?: string;
  previewable?: boolean;
  cropAspect?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropName, setCropName] = useState("image.jpg");
  const [cropOpen, setCropOpen] = useState(false);
  const [preparingCrop, setPreparingCrop] = useState(false);

  // Revoke object URLs created for locally-selected files.
  useEffect(() => {
    return () => {
      if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const openCropForFile = (file: File) => {
    setCropName(file.name);
    setCropSrc(URL.createObjectURL(file));
    setCropOpen(true);
  };

  const openCropForValue = async () => {
    if (!value) return;
    setPreparingCrop(true);
    try {
      let url = value;
      if (!/^https?:\/\//i.test(value)) {
        const signed = await signContentMediaUrl({ data: { path: value } });
        url = signed.signedUrl;
      }
      setCropName(value.split("/").pop() || "image.jpg");
      setCropSrc(url);
      setCropOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open this image for editing.");
    } finally {
      setPreparingCrop(false);
    }
  };

  const previewSrc = (() => {
    if (!value || !previewable) return null;
    if (/^https?:\/\//i.test(value)) return value;
    // storage path -> we can't render private paths directly; skip preview
    return null;
  })();

  const handleFiles = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      const id = crypto.randomUUID().slice(0, 8);
      const storagePath = `${folder}/${y}/${m}/${id}-${slugifyName(file.name)}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
        cacheControl: "31536000",
      });
      if (upErr) throw upErr;

      if (returnAs === "path") {
        onChange(storagePath);
      } else {
        const { signedUrl } = await signContentMediaUrl({
          data: { path: storagePath },
        });
        onChange(signedUrl);
      }
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <ImagePlus className="h-3.5 w-3.5" />
        {label}
      </Label>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <LinkIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="pl-8"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.type.startsWith("image/")) openCropForFile(file);
            else void handleFiles(file);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Upload
        </Button>
        {value && previewable ? (
          <Button
            type="button"
            variant="outline"
            disabled={preparingCrop || uploading}
            onClick={() => void openCropForValue()}
          >
            {preparingCrop ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Crop className="mr-2 h-4 w-4" />
            )}
            Crop
          </Button>
        ) : null}
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            title="Clear"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {previewSrc ? (
        <div className="overflow-hidden rounded-md border border-border/70 bg-muted">
          <img
            src={previewSrc}
            alt=""
            className="max-h-40 w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ) : null}

      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={(next) => {
          setCropOpen(next);
          if (!next && cropSrc?.startsWith("blob:")) {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }
        }}
        src={cropSrc}
        fileName={cropName}
        initialAspect={cropAspect}
        onCropped={async (file) => {
          await handleFiles(file);
        }}
      />
    </div>
  );
}
