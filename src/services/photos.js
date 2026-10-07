// Receipt photos live in IndexedDB on this device only; transactions keep just a photoId.
const DB_NAME = 'hisapo_photos';
const STORE = 'photos';

let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function run(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
      })
  );
}

export const savePhoto = (id, blob) => run('readwrite', (s) => s.put(blob, id));
export const getPhoto = (id) => run('readonly', (s) => s.get(id));
export const deletePhoto = (id) => run('readwrite', (s) => s.delete(id));
export const listPhotoIds = () => run('readonly', (s) => s.getAllKeys());

// Remove photos no transaction points to any more (deleted or replaced).
export async function cleanupPhotos(transactions) {
  const used = new Set(transactions.map((t) => t.photoId).filter(Boolean));
  const ids = await listPhotoIds();
  await Promise.all(ids.filter((id) => !used.has(id)).map(deletePhoto));
}

export const newPhotoId = () => 'ph-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

// Downscale to keep a receipt readable but small (about 100–250 KB).
export async function compressImage(file, maxSide = 1400, quality = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality));
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
