/** Side length of the stored square icon, in pixels. */
export const ICON_SIZE = 256;

type Source = { image: CanvasImageSource; width: number; height: number; done: () => void };

async function load(file: Blob): Promise<Source> {
  // createImageBitmap honours EXIF orientation (phone photos are often stored sideways).
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { image: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
  } catch {
    // Fallback for formats/browsers where that fails; <img> also applies EXIF orientation.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('無法讀取這張照片，請換一張試試');
    }
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
}

/**
 * Centre-crop a photo to a square, shrink it to ICON_SIZE and return a JPEG
 * data URL (~20–40 KB). Runs entirely on the device; nothing is uploaded.
 */
export async function photoToIcon(file: Blob, size = ICON_SIZE): Promise<string> {
  const src = await load(file);
  try {
    const side = Math.min(src.width, src.height);
    if (!side) throw new Error('無法讀取這張照片，請換一張試試');
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('這個瀏覽器無法處理照片');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src.image, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    src.done();
  }
}
