import { parseReceipt } from './receipt';
import { whitenBackground, orientations, readingScore, isComplete } from './receiptImage';

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

function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

// The photo turned by angle (0/90/180/270, clockwise) with the background whitened
function prepare(img, angle) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const sideways = angle % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = sideways ? h : w;
  canvas.height = sideways ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  whitenBackground(pixels.data);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

// Image (Blob/File) → { fields, text }. A receipt photographed sideways is turned upright:
// the likely angles are read in turn until amount, litres and price agree.
export async function readReceipt(image) {
  const worker = await getWorker();
  const img = await loadImage(image);
  let best = null;
  for (const angle of orientations(img.naturalWidth, img.naturalHeight)) {
    const { data } = await worker.recognize(prepare(img, angle));
    const fields = parseReceipt(data.text);
    const score = readingScore(fields, data.confidence);
    if (!best || score > best.score) best = { fields, text: data.text, score };
    if (isComplete(fields)) break;
  }
  return { fields: best.fields, text: best.text };
}
