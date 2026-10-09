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
