// Copies the on-device receipt reader (Tesseract worker, engine and Turkish data) next to the app,
// so it loads from our own site and keeps working offline once used.
import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] || 'public/ocr';
mkdirSync(out, { recursive: true });
const nm = 'node_modules';
cpSync(join(nm, 'tesseract.js/dist/worker.min.js'), join(out, 'worker.min.js'));
for (const v of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
  cpSync(join(nm, `tesseract.js-core/tesseract-core-${v}.wasm.js`), join(out, `tesseract-core-${v}.wasm.js`));
}
cpSync(join(nm, '@tesseract.js-data/tur/4.0.0_best_int/tur.traineddata.gz'), join(out, 'tur.traineddata.gz'));
console.log(`OCR files copied to ${out}`);
