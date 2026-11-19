/**
 * Reads the text in a photo on the device, with Tesseract (Spanish). The engine and the
 * language data come from the app itself (`/tesseract/`, see vite.config.ts), load only the
 * first time a receipt is read and stay cached; the photo never leaves the device.
 */
export async function readText(image: Blob, onProgress?: (share: number) => void) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/core',
    langPath: '/tesseract/lang',
    // A worker from our own URL, not a blob: the Content-Security-Policy allows only 'self'.
    workerBlobURL: false,
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
