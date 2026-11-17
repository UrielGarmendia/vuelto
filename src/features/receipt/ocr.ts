/**
 * Reads the text in a photo on the device, with Tesseract (Spanish). The library and the
 * language data load only the first time a receipt is read; the photo never leaves.
 */
export async function readText(image: Blob, onProgress?: (share: number) => void) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
