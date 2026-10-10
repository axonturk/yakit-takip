import { parseReceipt } from './receipt';
import { whitenBackground, findPaper, flattenLight, printBox, orientations, readingScore, isComplete } from './receiptImage';

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

// A small grey copy (one value per pixel) for finding the paper and the print
function smallGrey(src, s) {
  const [small, sctx] = canvasOf(Math.max(1, Math.round(src.width * s)), Math.max(1, Math.round(src.height * s)));
  sctx.drawImage(src, 0, 0, small.width, small.height);
  const rgba = sctx.getImageData(0, 0, small.width, small.height).data;
  const grey = new Uint8Array(small.width * small.height);
  for (let i = 0; i < grey.length; i++) grey[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  return [grey, small.width, small.height];
}

// The photo in grey with the background whitened, cut to the printed part and sized for reading
function clean(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const [full, ctx] = canvasOf(w, h);
  ctx.drawImage(img, 0, 0);
  // Work on a small copy for the boxes; it is quicker and just as good
  const s = Math.min(1, 1000 / Math.max(w, h));
  const paper = findPaper(...smallGrey(full, s));
  const pixels = ctx.getImageData(0, 0, w, h);
  whitenBackground(pixels.data);
  if (paper) {
    // Everything beside the paper (a dark table, a folder) becomes white so it is not read as print
    const d = pixels.data;
    const sh = paper.left.length;
    for (let y = 0; y < h; y++) {
      const row = Math.min(sh - 1, Math.floor(y * s));
      const [l, r] = paper.right[row] < paper.left[row] ? [w, -1] : [paper.left[row] / s, (paper.right[row] + 1) / s];
      for (let x = 0; x < w; x++) {
        if (x >= l && x < r) continue;
        const i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
      }
    }
  }
  ctx.putImageData(pixels, 0, 0);

  const box = printBox(...smallGrey(full, s)) || paper?.box;
  const [x, y, cw, ch] = box ? [box.x / s, box.y / s, box.w / s, box.h / s] : [0, 0, w, h];

  // Text reads best at about 2000 px on the long side; small or far-away print is enlarged
  const k = Math.min(2, 2000 / Math.max(cw, ch));
  const [out, octx] = canvasOf(Math.round(cw * k), Math.round(ch * k));
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(full, x, y, cw, ch, 0, 0, out.width, out.height);
  return out;
}

// The cleaned photo with its light evened out (see flattenLight)
function flattened(src, options) {
  const [out, ctx] = canvasOf(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const pixels = ctx.getImageData(0, 0, out.width, out.height);
  const d = pixels.data;
  const grey = new Uint8Array(out.width * out.height);
  for (let i = 0; i < grey.length; i++) grey[i] = d[i * 4];
  flattenLight(grey, out.width, out.height, Math.round(Math.max(out.width, out.height) / 40), options);
  for (let i = 0; i < grey.length; i++) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = grey[i];
  ctx.putImageData(pixels, 0, 0);
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
  // Sharp prints read best lightly evened out; faded thermal paper needs its pale print darkened.
  // The second only gets a try when the first misses something, upright first.
  const light = flattened(cleaned, { lo: 0.2, gamma: 1 });
  const strong = () => flattened(cleaned, { lo: 0.6, gamma: 1.5 });
  const [first, ...others] = orientations(cleaned.width, cleaned.height);
  const attempts = [() => turn(light, first), () => turn(strong(), first), ...others.map((angle) => () => turn(light, angle))];
  let best = null;
  for (const attempt of attempts) {
    const { data } = await worker.recognize(attempt());
    const fields = parseReceipt(data.text, { country });
    const score = readingScore(fields, data.confidence);
    if (!best || score > best.score) best = { fields, text: data.text, score };
    if (isComplete(fields)) break;
  }
  return { fields: best.fields, text: best.text };
}
