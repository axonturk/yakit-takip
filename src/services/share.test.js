import { describe, it, expect } from 'vitest';
import { normalizePhone, formatPhone, whatsappUrl } from './share';

describe('share', () => {
  it('turns Turkish and international numbers into WhatsApp form', () => {
    expect(normalizePhone('0532 123 45 67')).toBe('905321234567');
    expect(normalizePhone('532-123-4567')).toBe('905321234567');
    expect(normalizePhone('+90 (532) 123 45 67')).toBe('905321234567');
    expect(normalizePhone('0090 532 123 45 67')).toBe('905321234567');
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
    expect(normalizePhone('123')).toBe('');
    expect(normalizePhone('')).toBe('');
  });

  it('shows numbers readably and builds links', () => {
    expect(formatPhone('905321234567')).toBe('0532 123 45 67');
    expect(formatPhone('919876543210')).toBe('+919876543210');
    expect(whatsappUrl('a b', '905321234567')).toBe('https://wa.me/905321234567?text=a%20b');
    expect(whatsappUrl('x')).toBe('https://wa.me/?text=x');
  });
});
