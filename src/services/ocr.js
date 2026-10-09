import { parseReceipt } from './receipt';
import { whitenBackground, printBox, orientations, readingScore, isComplete } from './receiptImage';

// On-device receipt reading. The engine and the language data (a few MB) are downloaded on first use only,
// from our own site, and the service worker keeps them for offline use after that.
const workers = {};

function getWorker(langs) {
  const key = langs.join('+');
  if (!workers[key]) {
    const base = new URL('ocr/', document.baseURI).href;
    workers[key] = import('tesseract.js')
      .then(({ createWorker }) =>
        createWorker(langs, 1, {
          workerPath: `${base}worker.min.js`,
          corePath: base,
          langPath: base.replace(/\/$/, ''),
          gzip: true
        })
      )
      .catch((e) => {
        delete workers[key];
        throw e;
      });
  }
  return workers[key];
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

function canvasOf(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d', { willReadFrequently: true })];
}

// The photo in grey with the background whitened, cut to the printed part and sized for reading
function clean(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const [full, ctx] = canvasOf(w, h);
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, w, h);
  whitenBackground(pixels.data);
  ctx.putImageData(pixels, 0, 0);

  // Find the print on a small copy; it is quicker and just as good for a box
  const s = Math.min(1, 1000 / Math.max(w, h));
  const [small, sctx] = canvasOf(Math.round(w * s), Math.round(h * s));
  sctx.drawImage(full, 0, 0, small.width, small.height);
  const rgba = sctx.getImageData(0, 0, small.width, small.height).data;
  const grey = new Uint8Array(small.width * small.height);
  for (let i = 0; i < grey.length; i++) grey[i] = rgba[i * 4];
  const box = printBox(grey, small.width, small.height);
  const [x, y, cw, ch] = box ? [box.x / s, box.y / s, box.w / s, box.h / s] : [0, 0, w, h];

  // Text reads best at about 2000 px on the long side; small or far-away print is enlarged
  const k = Math.min(2, 2000 / Math.max(cw, ch));
  const [out, octx] = canvasOf(Math.round(cw * k), Math.round(ch * k));
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(full, x, y, cw, ch, 0, 0, out.width, out.height);
  return out;
}

// The cleaned photo turned by angle (0/90/180/270, clockwise)
function turn(src, angle) {
  if (!angle) return src;
  const sideways = angle % 180 !== 0;
  const [canvas, ctx] = canvasOf(sideways ? src.height : src.width, sideways ? src.width : src.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return canvas;
}

// Image (Blob/File) → { fields, text }. country sets the receipt's language and number style
// (see receiptLanguage). A receipt photographed sideways or upside down is turned upright:
// the likely angles are read in turn until amount, litres and price agree.
export async function readReceipt(image, { country = 'TR', langs = ['tur'] } = {}) {
  const worker = await getWorker(langs);
  const img = await loadImage(image);
  const cleaned = clean(img);
  let best = null;
  for (const angle of orientations(cleaned.width, cleaned.height)) {
    const { data } = await worker.recognize(turn(cleaned, angle));
    const fields = parseReceipt(data.text, { country });
    const score = readingScore(fields, data.confidence);
    if (!best || score > best.score) best = { fields, text: data.text, score };
    if (isComplete(fields)) break;
  }
  return { fields: best.fields, text: best.text };
}

