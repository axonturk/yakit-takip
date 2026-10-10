import { describe, it, expect } from 'vitest';
import { whitenBackground, findPaper, flattenLight, printBox, orientations, readingScore, isComplete } from './receiptImage';

describe('receipt photo preparation', () => {
  it('keeps black print and white paper, and whitens a wooden table', () => {
    const px = new Uint8ClampedArray([
      20, 20, 22, 255, // print
      240, 238, 236, 255, // paper
      170, 105, 60, 255 // wood
    ]);
    whitenBackground(px);
    expect(px[0]).toBeLessThan(30);
    expect(px[1]).toBe(px[0]);
    expect(px[4]).toBeGreaterThan(230);
    expect([px[8], px[9], px[10], px[11]]).toEqual([255, 255, 255, 255]);
  });

  it('tries turning a wide photo first', () => {
    expect(orientations(2048, 1536)[0]).toBe(90);
    expect(orientations(1536, 2048)[0]).toBe(0);
  });

  it('prefers the reading that found more of the receipt', () => {
    const full = { amount: 600, liters: 15.79, unitPrice: 37.99 };
    expect(readingScore(full, 40)).toBeGreaterThan(readingScore({ amount: 1600 }, 90));
    expect(isComplete(full)).toBe(true);
    expect(isComplete({ amount: 600 })).toBe(false);
  });
});

describe('finding the print in a photo taken from further away', () => {
  it('boxes the printed lines and leaves out a dark table edge', () => {
    const w = 200;
    const h = 200;
    const grey = new Uint8Array(w * h).fill(250);
    // a dark band along the top (table edge) and print lines in the middle
    for (let y = 0; y < 20; y++) for (let x = 0; x < w; x++) grey[y * w + x] = 30;
    for (let y = 80; y < 140; y += 6) for (let x = 70; x < 130; x++) if (x % 3) grey[y * w + x] = 20;
    const box = printBox(grey, w, h);
    expect(box.y).toBeGreaterThan(50);
    expect(box.y + box.h).toBeLessThan(170);
    expect(box.x).toBeGreaterThan(50);
    expect(box.x + box.w).toBeLessThan(150);
  });

  it('returns nothing when the print fills the photo', () => {
    expect(printBox(new Uint8Array(100 * 100).fill(250), 100, 100)).toBeNull();
  });
});

describe('finding the paper on a dark table', () => {
  it('finds the bright paper and keeps the print inside it', () => {
    const w = 100;
    const h = 120;
    const grey = new Uint8Array(w * h).fill(60); // a dark table
    for (let y = 10; y < 110; y++) for (let x = 30; x < 70; x++) grey[y * w + x] = 220; // the receipt
    for (let y = 20; y < 100; y += 5) for (let x = 35; x < 65; x++) grey[y * w + x] = 30; // its print
    const paper = findPaper(grey, w, h);
    expect(paper.box).toEqual({ x: 30, y: 10, w: 40, h: 100 });
    expect([paper.left[50], paper.right[50]]).toEqual([30, 69]);
    expect(paper.right[5]).toBeLessThan(paper.left[5]);
  });

  it('leaves a photo alone when the paper fills it or nothing stands out', () => {
    expect(findPaper(new Uint8Array(50 * 50).fill(230), 50, 50)).toBeNull();
    const even = new Uint8Array(50 * 50).map((_, i) => (i % 2 ? 120 : 140));
    expect(findPaper(even, 50, 50)).toBeNull();
  });
});

describe('evening out light', () => {
  it('turns shaded paper white and keeps faint print darker than the paper', () => {
    const w = 80;
    const h = 80;
    const grey = new Uint8Array(w * h);
    // paper fading from 240 on the left to 140 on the right, with a faint print column in each half
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grey[y * w + x] = Math.round(240 - (100 * x) / w);
    for (let y = 0; y < h; y++) {
      grey[y * w + 20] = Math.round(grey[y * w + 20] * 0.6);
      grey[y * w + 60] = Math.round(grey[y * w + 60] * 0.6);
    }
    flattenLight(grey, w, h, 10);
    expect(grey[40 * w + 10]).toBeGreaterThan(230);
    expect(grey[40 * w + 70]).toBeGreaterThan(230);
    expect(grey[40 * w + 20]).toBeLessThan(170);
    expect(grey[40 * w + 60]).toBeLessThan(170);
  });
});
