import { describe, it, expect, vi } from 'vitest';

const uploaded = [];
vi.mock('./cloud', () => ({
  uploadPhoto: vi.fn(async (ws, id) => uploaded.push(`${ws}/${id}`)),
  downloadPhoto: vi.fn(),
  getClient: vi.fn(),
  cloudWasUsed: () => false,
  loadMeta: () => ({}),
  saveMeta: () => {},
  pullRecords: vi.fn(),
  pushRecords: vi.fn(),
  myMembership: vi.fn()
}));
vi.mock('./photos', () => ({
  listPhotoIds: async () => ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
  getPhoto: async (id) => new Blob([id], { type: 'image/jpeg' }),
  setRemotePhotoSource: () => {}
}));

const { pushPhotos } = await import('./useCloudSync');

describe('pushPhotos', () => {
  it('uploads only local, not yet uploaded photos, a few at a time', async () => {
    const txs = [
      { id: 't0', photoId: 'remote-only' },
      { id: 't1', photoId: 'p1' },
      { id: 't2' },
      ...['p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((p, i) => ({ id: `x${i}`, photoId: p }))
    ];
    const done = await pushPhotos('ws', txs, { p1: 1 });
    expect(uploaded).toEqual(['ws/p2', 'ws/p3', 'ws/p4', 'ws/p5', 'ws/p6']);
    expect(Object.keys(done).sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    const again = await pushPhotos('ws', txs, done);
    expect(uploaded.at(-1)).toBe('ws/p7');
    expect(again.p7).toBe(1);
  });
});
