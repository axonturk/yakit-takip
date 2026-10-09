// Copies the on-device receipt reader (Tesseract worker, engine and language data) next to the app,
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
// Only the languages a receipt needs are downloaded on the phone (see receiptLanguage)
for (const lang of ['tur', 'eng', 'fra', 'spa', 'deu']) {
  cpSync(join(nm, `@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`), join(out, `${lang}.traineddata.gz`));
}
console.log(`OCR files copied to ${out}`);
