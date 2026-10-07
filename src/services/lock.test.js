import { describe, it, expect } from 'vitest';
import { makeLock, checkPin, validPin, waitAfterFails, shouldRelock } from './lock';

describe('lock', () => {
  it('accepts the right PIN only, never storing it', async () => {
    const cfg = await makeLock('4821', 5);
    expect(JSON.stringify(cfg)).not.toContain('4821');
    expect(cfg.len).toBe(4);
    expect(await checkPin(cfg, '4821')).toBe(true);
    expect(await checkPin(cfg, '4822')).toBe(false);
    const other = await makeLock('4821');
    expect(other.hash).not.toBe(cfg.hash);
  });

  it('takes 4 to 6 digits', () => {
    expect(validPin('123')).toBe(false);
    expect(validPin('1234')).toBe(true);
    expect(validPin('123456')).toBe(true);
    expect(validPin('12a4')).toBe(false);
  });

  it('slows down guessing after 5 wrong tries', () => {
    expect(waitAfterFails(4)).toBe(0);
    expect(waitAfterFails(5)).toBe(30000);
    expect(waitAfterFails(6)).toBe(60000);
    expect(waitAfterFails(20)).toBe(15 * 60000);
  });

  it('relocks after the chosen time in the background', () => {
    const cfg = { after: 1 };
    expect(shouldRelock(cfg, 0, 59999)).toBe(false);
    expect(shouldRelock(cfg, 0, 60000)).toBe(true);
    expect(shouldRelock({ after: 0 }, 0, 10)).toBe(true);
    expect(shouldRelock(null, 0, 10 ** 9)).toBe(false);
    expect(shouldRelock(cfg, null, 10 ** 9)).toBe(false);
  });
});
