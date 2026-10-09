import { describe, it, expect } from 'vitest';
import { whitenBackground, orientations, readingScore, isComplete } from './receiptImage';

describe('receipt photo preparation', () => {
  it('keeps black print and white paper, and whitens a wooden table', () => {
    const px = new Uint8ClampedArray([
      20, 20, 22, 255, // print
      240, 238, 236, 255, // paper
      170, 105, 60, 255 // wood
    ]);
    whitenBackground(px);
    expect([px[0], px[1], px[2]]).toEqual([20, 20, 20]);
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
