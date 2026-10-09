// Detects a newer deploy: the built index.html references a hashed bundle (assets/index-XXXX.js),
// so a different name in the server copy means a new version is live.
export function bundleName(html) {
  const m = /assets\/index-[\w-]+\.js/.exec(html || '');
  return m ? m[0] : null;
}

export function currentBundle(doc = document) {
  for (const s of doc.querySelectorAll('script[src]')) {
    const name = bundleName(s.getAttribute('src'));
    if (name) return name;
  }
  return null;
}

export async function hasNewVersion() {
  const current = currentBundle();
  if (!current) return false; // dev server: no hashed bundle
  const res = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return false;
  const latest = bundleName(await res.text());
  return Boolean(latest && latest !== current);
}
