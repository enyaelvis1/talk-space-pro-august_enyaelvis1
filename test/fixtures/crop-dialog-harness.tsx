import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { ImageCropDialog } from "@/components/admin/ImageCropDialog";
import "@/styles.css";

/**
 * Test-only harness that mounts the admin crop dialog on its own so the
 * end-to-end test can drive it without signing into the admin console.
 *
 * The source image is generated in the browser as a very tall portrait
 * (1080x2400) — the shape that previously made the "Original" preset grow the
 * dialog past the viewport and hide the Apply & upload button.
 */
function Harness() {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 2400;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#2f6f5f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(120, 200, 840, 600);
    setSrc(canvas.toDataURL("image/png"));
  }, []);

  if (!src) return <p>preparing image…</p>;

  return (
    <ImageCropDialog
      open
      onOpenChange={() => {}}
      src={src}
      fileName="tall-portrait.png"
      initialAspect="16:9"
      onCropped={(file) => {
        (window as unknown as { __cropped?: string }).__cropped = file.name;
      }}
    />
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
