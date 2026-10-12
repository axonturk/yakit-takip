import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendFeedback } from './feedback';

describe('pilot feedback', () => {
  let calls;
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 201 };
    }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uploads the receipt photo first, then saves what was read and what was kept', async () => {
    const photo = new Blob(['x'], { type: 'image/jpeg' });
    await sendFeedback({ kind: 'receipt', photo, info: { read: { amount: 101 }, saved: { amount: 101.21 } } });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toMatch(/\/storage\/v1\/object\/feedback\/receipt\/\d{4}-\d{2}\/[\w-]+\.jpg$/);
    expect(calls[0].init.body).toBe(photo);
    expect(calls[1].url).toMatch(/\/rest\/v1\/feedback$/);
    const row = JSON.parse(calls[1].init.body);
    expect(row).toMatchObject({ kind: 'receipt', photo: calls[0].url.split('/feedback/')[1], message: null, contact: null });
    expect(row.info).toMatchObject({ read: { amount: 101 }, saved: { amount: 101.21 }, country: 'TR', currency: 'TRY' });
  });

  it('sends a bug report without a photo and trims what was typed', async () => {
    await sendFeedback({ kind: 'bug', message: '  Rapor açılmıyor  ', contact: ' a@b.com ' });
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].init.body)).toMatchObject({ kind: 'bug', message: 'Rapor açılmıyor', contact: 'a@b.com' });
  });

  it('tells the caller when the server refuses', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 400 });
    await expect(sendFeedback({ kind: 'bug', message: 'x' })).rejects.toThrow('400');
  });
});
