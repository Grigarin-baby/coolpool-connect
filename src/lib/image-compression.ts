/**
 * Client-side image compression.
 *
 * Phone cameras produce 3-8 MB photos. Uploading those raw is slow on mobile
 * data and trips the reverse-proxy body-size limit (nginx returned 413). We
 * downscale + re-encode to JPEG in the browser so each upload is a few hundred
 * KB — fast, and comfortably under any proxy limit.
 *
 * Non-image files (e.g. PDF registration/insurance docs) are returned
 * untouched. If anything goes wrong, we fall back to the original file so an
 * upload is never blocked by compression.
 */

export interface CompressImageOptions {
  /** Longest edge of the output, in pixels. */
  maxDimension?: number;
  /** JPEG quality, 0-1. */
  quality?: number;
  /** Skip compression for files already at or below this size (bytes). */
  skipBelowBytes?: number;
}

const DEFAULTS: Required<CompressImageOptions> = {
  maxDimension: 1600,
  quality: 0.8,
  skipBelowBytes: 300 * 1024, // 300 KB
};

export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const { maxDimension, quality, skipBelowBytes } = { ...DEFAULTS, ...options };

  // Only compress raster images. Leave PDFs / other files alone.
  if (!file.type.startsWith("image/")) return file;
  // GIFs would lose animation; SVGs are vector. Skip both.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size <= skipBelowBytes) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, maxDimension);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file; // never make it bigger

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Decoding/encoding failed — upload the original rather than nothing.
    return file;
  }
}

function scaleToFit(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(file);
  }
  // Fallback for browsers without createImageBitmap.
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
