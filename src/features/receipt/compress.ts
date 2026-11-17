/** Width and height that fit `max` on the longer side, never enlarging. */
export function fitSize(width: number, height: number, max = 1600) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * A photo made small enough to read and keep: longer side 1600 px, WebP at 0.8. Browsers
 * that cannot encode WebP (Safari hands back PNG) get JPEG instead.
 */
export async function compressImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.8));
  const webp = await encode('image/webp');
  if (webp?.type === 'image/webp') return webp;
  return (await encode('image/jpeg')) ?? file;
}
