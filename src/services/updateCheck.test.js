import { describe, it, expect } from 'vitest';
import { bundleName } from './updateCheck';

describe('bundleName', () => {
  it('finds the hashed bundle in built html', () => {
    const html = '<script type="module" crossorigin src="./assets/index-B3x_9kQa.js"></script>';
    expect(bundleName(html)).toBe('assets/index-B3x_9kQa.js');
  });
  it('returns null without a bundle', () => {
    expect(bundleName('<script src="/src/main.jsx"></script>')).toBeNull();
    expect(bundleName('')).toBeNull();
  });
});
