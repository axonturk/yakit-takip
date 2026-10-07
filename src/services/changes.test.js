import { describe, it, expect } from 'vitest';
import { describeChange, shortEmail } from './changes';

const tx = { id: 't1', type: 'expense', stationId: 's1', stationName: 'Shell Merkez', amount: 1200, date: '2026-10-07T10:00' };

describe('describeChange', () => {
  it('names a new expense with its station', () => {
    const d = describeChange({ kind: 'tx', id: 't1', action: 'create', data: tx });
    expect(d.title).toBe('Depo Dolumu eklendi · Shell Merkez');
    expect(d.amount).toBe(1200);
    expect(d.sign).toBe('−');
    expect(d.details).toEqual([]);
  });

  it('lists the fields an edit changed', () => {
    const d = describeChange({
      kind: 'tx', id: 't1', action: 'update',
      previous: tx,
      data: { ...tx, amount: 1350, plate: '34 ABC 12', photoId: 'p1' }
    });
    expect(d.details).toEqual([
      expect.stringMatching(/^Tutar: .*1\.200,00 → .*1\.350,00$/),
      'Plaka: — → 34 ABC 12',
      'Fotoğraf eklendi'
    ]);
  });

  it('describes a deleted top-up from its last version', () => {
    const d = describeChange({ kind: 'tx', id: 't2', action: 'delete', data: null, previous: { ...tx, type: 'topup', amount: 5000 } });
    expect(d.title).toBe('Avans Yüklendi silindi · Shell Merkez');
    expect(d.sign).toBe('+');
  });

  it('describes station renames', () => {
    const d = describeChange({ kind: 'station', id: 's1', action: 'update', previous: { name: 'Shell' }, data: { name: 'Shell Merkez' } });
    expect(d.title).toBe('İstasyon düzenlendi: Shell Merkez');
    expect(d.details).toEqual(['Ad: Shell → Shell Merkez']);
  });

  it('shortens e-mails', () => {
    expect(shortEmail('ali.veli@firma.com')).toBe('ali.veli');
    expect(shortEmail(null)).toBe('Bilinmiyor');
  });
});
