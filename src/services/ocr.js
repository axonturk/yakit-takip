import { parseReceipt } from './receipt';

// On-device receipt reading. The engine (~4 MB) is downloaded on first use only,
// from our own site, and the service worker keeps it for offline use after that.
let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    const base = new URL('ocr/', document.baseURI).href;
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) =>
        createWorker('tur', 1, {
          workerPath: `${base}worker.min.js`,
          corePath: base,
          langPath: base.replace(/\/$/, ''),
          gzip: true
        })
      )
      .catch((e) => {
        workerPromise = null;
        throw e;
      });
  }
  return workerPromise;
}

// Image (Blob/File) → { fields, text }
export async function readReceipt(image) {
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return { fields: parseReceipt(data.text), text: data.text };
}
