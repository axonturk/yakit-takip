// Saved WhatsApp recipients (accountant, partner, station) so a report goes to them in one tap.
const CONTACTS_KEY = 'hisapo_contacts_v1';

export function loadContacts() {
  try {
    const list = JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((c) => c && c.phone) : [];
  } catch {
    return [];
  }
}

export function saveContacts(list) {
  try {
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: the list just isn't remembered */
  }
}

// WhatsApp wants the number with country code and digits only. Turkish local forms get 90.
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('05')) d = `9${d}`;
  else if (d.length === 10 && d.startsWith('5')) d = `90${d}`;
  return d.length >= 10 && d.length <= 15 ? d : '';
}

export function formatPhone(phone) {
  const m = /^90(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${phone}`;
}

export function whatsappUrl(text, phone) {
  return `https://wa.me/${phone || ''}?text=${encodeURIComponent(text)}`;
}

// Phones that can hand a file to WhatsApp (Android Chrome, iOS Safari) support this.
export function canShareFile(file) {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}
