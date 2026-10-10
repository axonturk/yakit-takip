// Pure helpers for preparing a receipt photo before it is read (no browser APIs, so they can be tested).

// Turns the photo grey and paints coloured areas white. Receipt paper is white and its print is black,
// so anything clearly coloured (a wooden table, a car seat, a hand) is background that confuses the reader.
// Colours are first balanced on the brightest part (the paper), so a receipt under warm or yellow light
// still counts as white instead of being painted out with its print.
export function whitenBackground(data, threshold = 60) {
  const hist = new Uint32Array(766);
  for (let i = 0; i < data.length; i += 4) hist[data[i] + data[i + 1] + data[i + 2]]++;
  let cut = 765;
  let seen = hist[765];
  const need = (data.length / 4) * 0.02;
  while (cut > 0 && seen < need) seen += hist[--cut];
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] >= cut) {
      sr += data[i];
      sg += data[i + 1];
      sb += data[i + 2];
      n++;
    }
  }
  const gain = (sum) => Math.min(3, 255 / Math.max(1, sum / Math.max(1, n)));
  const [gr, gg, gb] = [gain(sr), gain(sg), gain(sb)];
  for (let i = 0; i < data.length; i += 4) {
    const r = Math.min(255, data[i] * gr);
    const g = Math.min(255, data[i + 1] * gg);
    const b = Math.min(255, data[i + 2] * gb);
    const grey = Math.max(r, g, b) - Math.min(r, g, b) > threshold ? 255 : Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    data[i] = data[i + 1] = data[i + 2] = grey;
  }
  return data;
}

// The receipt paper in a photo of it lying on something darker (a table, a car seat, a folder):
// the largest bright area, with its outline filled row by row so the print inside counts as paper.
// grey: one value per pixel (before any whitening). Returns { box, left, right } with the paper's
// left and right edge on each row (left > right where a row has no paper), or null when the paper
// fills the photo or no paper stands out from the background.
export function findPaper(grey, w, h) {
  // Otsu's threshold between background and paper
  const hist = new Float64Array(256);
  for (let i = 0; i < grey.length; i++) hist[grey[i]]++;
  const total = grey.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let cut = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB || wB === total) continue;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / (total - wB);
    const between = wB * (total - wB) * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      cut = t;
    }
  }
  const bright = new Uint8Array(w * h);
  let nBright = 0;
  for (let i = 0; i < grey.length; i++) {
    if (grey[i] > cut) {
      bright[i] = 1;
      nBright++;
    }
  }
  // Paper filling nearly all of the photo, or background hardly darker than paper: nothing to cut
  if (nBright > 0.85 * total) return null;
  let darkSum = 0;
  let lightSum = 0;
  for (let i = 0; i < grey.length; i++) {
    if (bright[i]) lightSum += grey[i];
    else darkSum += grey[i];
  }
  if (lightSum / nBright - darkSum / (total - nBright) < 50) return null;

  // Largest connected bright area
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let bestLabel = 0;
  let bestSize = 0;
  let next = 0;
  for (let s = 0; s < w * h; s++) {
    if (!bright[s] || label[s]) continue;
    next++;
    let size = 0;
    let top = 0;
    stack[top++] = s;
    label[s] = next;
    while (top) {
      const i = stack[--top];
      size++;
      const x = i % w;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
      for (const j of nb) {
        if (j >= 0 && j < w * h && bright[j] && !label[j]) {
          label[j] = next;
          stack[top++] = j;
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = next;
    }
  }
  if (bestSize < 0.05 * total) return null;

  const left = new Int32Array(h).fill(w);
  const right = new Int32Array(h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (label[y * w + x] === bestLabel) {
        if (x < left[y]) left[y] = x;
        right[y] = x;
      }
    }
  }
  let x0 = w;
  let x1 = -1;
  let y0 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    if (right[y] < left[y]) continue;
    if (y0 < 0) y0 = y;
    y1 = y;
    x0 = Math.min(x0, left[y]);
    x1 = Math.max(x1, right[y]);
  }
  const box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  if (box.w * box.h > 0.9 * total) return null;
  return { box, left, right };
}

// Evens out light and fades: each pixel is divided by the brightness of the paper around it, so a
// shadow or a corner in dim light turns white again and pale thermal print turns dark.
// grey: one value per pixel, changed in place. r: how far around to look for the paper.
// lo: how pale (as a share of the paper's brightness) still counts as print; higher darkens faint print more.
export function flattenLight(grey, w, h, r, { lo = 0.2, gamma = 1 } = {}) {
  // The paper's brightness near each pixel: the bright end of a box around it, from a small grid
  const step = Math.max(4, Math.round(r / 2));
  const gw = Math.ceil(w / step);
  const gh = Math.ceil(h / step);
  const cell = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const vals = [];
      for (let y = Math.max(0, gy * step - r); y < Math.min(h, gy * step + r); y += 2) {
        for (let x = Math.max(0, gx * step - r); x < Math.min(w, gx * step + r); x += 2) vals.push(grey[y * w + x]);
      }
      vals.sort((a, b) => a - b);
      cell[gy * gw + gx] = vals.length ? vals[Math.floor(vals.length * 0.9)] : 255;
    }
  }
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1, y / step);
    const y0 = Math.floor(fy);
    const y1 = Math.min(gh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1, x / step);
      const x0 = Math.floor(fx);
      const x1 = Math.min(gw - 1, x0 + 1);
      const tx = fx - x0;
      const bg =
        (cell[y0 * gw + x0] * (1 - tx) + cell[y0 * gw + x1] * tx) * (1 - ty) + (cell[y1 * gw + x0] * (1 - tx) + cell[y1 * gw + x1] * tx) * ty;
      const v = grey[y * w + x] / Math.max(40, bg);
      // Paper white, print black, and pale print pulled towards black
      grey[y * w + x] = Math.round(255 * Math.min(1, Math.max(0, (v - lo) / (0.98 - lo))) ** gamma);
    }
  }
  return grey;
}

// The printed part of a photo taken from further away: the box around the print, so it can be cut out
// and enlarged. Print is dark with paper around it; big dark areas (a table edge, a shadow) are not print.
// grey: one value per pixel. Returns { x, y, w, h } or null when the print already fills the photo.
export function printBox(grey, w, h) {
  const r = Math.max(4, Math.round(Math.max(w, h) / 120));
  const sum = (mask) => {
    const ii = new Int32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += mask[y * w + x];
        ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row;
      }
    }
    return (x, y) => {
      const x0 = Math.max(0, x - r);
      const y0 = Math.max(0, y - r);
      const x1 = Math.min(w, x + r + 1);
      const y1 = Math.min(h, y + r + 1);
      return [ii[y1 * (w + 1) + x1] - ii[y0 * (w + 1) + x1] - ii[y1 * (w + 1) + x0] + ii[y0 * (w + 1) + x0], (x1 - x0) * (y1 - y0)];
    };
  };
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) dark[i] = grey[i] < 120 ? 1 : 0;
  const darkAround = sum(dark);
  const big = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [d, area] = darkAround(x, y);
      big[y * w + x] = d / area > 0.6 ? 1 : 0;
    }
  }
  const bigAround = sum(big);
  const xs = [];
  const ys = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!dark[y * w + x]) continue;
      const [d, area] = darkAround(x, y);
      const f = d / area;
      if (f > 0.04 && f < 0.45 && bigAround(x, y)[0] === 0) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < 200) return null;
  const pct = (arr, q) => arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * q))];
  const [x0, x1, y0, y1] = [pct(xs, 0.01), pct(xs, 0.99), pct(ys, 0.01), pct(ys, 0.99)];
  const px = 0.06 * (x1 - x0) + 4;
  const py = 0.03 * (y1 - y0) + 4;
  const box = {
    x: Math.max(0, Math.floor(x0 - px)),
    y: Math.max(0, Math.floor(y0 - py)),
    w: 0,
    h: 0
  };
  box.w = Math.min(w, Math.ceil(x1 + px)) - box.x;
  box.h = Math.min(h, Math.ceil(y1 + py)) - box.y;
  return box.w * box.h > 0.8 * w * h ? null : box;
}

// Receipts are tall and narrow; a wide photo was taken sideways. Angles (clockwise) to try, most likely first;
// upside down last.
export function orientations(width, height) {
  return width > height ? [90, 270, 0, 180] : [0, 90, 270, 180];
}

// How much of the receipt one reading understood; the best of the tried angles is kept.
export function readingScore(fields, confidence = 0) {
  const weights = { amount: 4, liters: 2, unitPrice: 2, date: 1, receiptNo: 1, plate: 1, fuelType: 1 };
  return Object.keys(fields).reduce((sum, k) => sum + (weights[k] || 0), 0) + confidence / 100;
}

// Amount, litres and price that agree with each other: no need to try another angle
export const isComplete = (fields) => Boolean(fields.amount && fields.liters && fields.unitPrice);
