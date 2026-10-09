// Pure helpers for preparing a receipt photo before it is read (no browser APIs, so they can be tested).

// Turns the photo grey and paints coloured areas white. Receipt paper is white and its print is black,
// so anything clearly coloured (a wooden table, a car seat, a hand) is background that confuses the reader.
export function whitenBackground(data, threshold = 45) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const grey = Math.max(r, g, b) - Math.min(r, g, b) > threshold ? 255 : Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    data[i] = data[i + 1] = data[i + 2] = grey;
  }
  return data;
}

// Receipts are tall and narrow; a wide photo was taken sideways. Angles (clockwise) to try, most likely first.
export function orientations(width, height) {
  return width > height ? [90, 270, 0] : [0, 90, 270];
}

// How much of the receipt one reading understood; the best of the tried angles is kept.
export function readingScore(fields, confidence = 0) {
  const weights = { amount: 4, liters: 2, unitPrice: 2, date: 1, receiptNo: 1, plate: 1, fuelType: 1 };
  return Object.keys(fields).reduce((sum, k) => sum + (weights[k] || 0), 0) + confidence / 100;
}

// Amount, litres and price that agree with each other: no need to try another angle
export const isComplete = (fields) => Boolean(fields.amount && fields.liters && fields.unitPrice);
