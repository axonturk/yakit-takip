import { createWorker } from 'tesseract.js';

let workerInstance = null;

// Lazy initialize Tesseract worker
async function getWorker(onProgress) {
  if (!workerInstance) {
    workerInstance = await createWorker('tur+eng', 1, {
      logger: m => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.round(m.progress * 100));
        }
      }
    });
    // Configure worker for digits, symbols, and currency
    await workerInstance.setParameters({
      tessedit_char_whitelist: '0123456789.,:/-TLltTL LlitretutarfiyatTOPLAMTOP TutarFiyat',
    });
  }
  return workerInstance;
}

// Enhance image on canvas (high contrast & thresholding for 7-segment displays)
export function preprocessCanvas(sourceCanvas, targetCanvas) {
  const ctx = targetCanvas.getContext('2d');
  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = sourceCanvas.height;
  ctx.drawImage(sourceCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  const data = imgData.data;

  // Grayscale and increase contrast
  for (let i = 0; i < data.length; i += 4) {
    const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Contrast boost
    const contrast = 1.6;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    let color = factor * (avg - 128) + 128;
    color = Math.max(0, Math.min(255, color));

    // Simple thresholding
    const threshold = color > 130 ? 255 : 30;

    data[i] = threshold;
    data[i + 1] = threshold;
    data[i + 2] = threshold;
  }

  ctx.putImageData(imgData, 0, 0);
  return targetCanvas;
}

// Parse pump screen OCR text and apply mathematical cross-check: Liters * UnitPrice = Total
export function parsePumpText(rawText) {
  console.log('[OCR Raw Output]:', rawText);

  // Normalize commas to dots
  const clean = rawText
    .replace(/,/g, '.')
    .replace(/[^\d.\n]/g, ' ')
    .trim();

  // Find all floating numbers
  const numberTokens = clean
    .split(/\s+/)
    .map(token => {
      const match = token.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : null;
    })
    .filter(n => n !== null && !isNaN(n) && n > 0);

  console.log('[Extracted Numbers]:', numberTokens);

  let bestMatch = {
    total: null,
    liters: null,
    unitPrice: null,
    confidence: 'low',
    verified: false
  };

  // Typical Turkish fuel price range (approx 35 to 60 TL/L)
  const isPlausibleUnitPrice = p => p >= 35 && p <= 65;
  const isPlausibleTotal = t => t >= 100 && t <= 25000;
  const isPlausibleLiters = l => l >= 2 && l <= 300;

  // Search for triplet or pair that satisfies: liters * unitPrice ≈ total
  for (let i = 0; i < numberTokens.length; i++) {
    for (let j = 0; j < numberTokens.length; j++) {
      if (i === j) continue;
      const val1 = numberTokens[i];
      const val2 = numberTokens[j];

      // Check if val1 is Liters and val2 is UnitPrice
      if (isPlausibleLiters(val1) && isPlausibleUnitPrice(val2)) {
        const calculatedTotal = Number((val1 * val2).toFixed(2));

        // Check if calculatedTotal exists in tokens
        const foundTotal = numberTokens.find(
          t => t !== val1 && t !== val2 && Math.abs(t - calculatedTotal) < 1.5
        );

        if (foundTotal) {
          return {
            total: foundTotal,
            liters: val1,
            unitPrice: val2,
            confidence: 'high',
            verified: true,
            note: 'Matematiksel Formül Doğrulandı (Litre × Fiyat = Tutar)'
          };
        }

        // If not found in tokens, we can still deduce the total
        if (!bestMatch.total) {
          bestMatch = {
            total: calculatedTotal,
            liters: val1,
            unitPrice: val2,
            confidence: 'medium',
            verified: true,
            note: 'Litre ve Birim Fiyattan Tutar Hesaplandı'
          };
        }
      }

      // Check if val1 is Total and val2 is UnitPrice -> deduce Liters
      if (isPlausibleTotal(val1) && isPlausibleUnitPrice(val2)) {
        const calculatedLiters = Number((val1 / val2).toFixed(2));
        if (isPlausibleLiters(calculatedLiters)) {
          bestMatch = {
            total: val1,
            liters: calculatedLiters,
            unitPrice: val2,
            confidence: 'medium',
            verified: true,
            note: 'Toplam ve Fiyattan Litre Hesaplandı'
          };
        }
      }
    }
  }

  // Fallback: Pick largest plausible number as Total Amount if nothing else matched
  if (!bestMatch.total) {
    const sorted = [...numberTokens].sort((a, b) => b - a);
    const candidateTotal = sorted.find(isPlausibleTotal) || sorted[0];
    if (candidateTotal) {
      bestMatch.total = candidateTotal;
      bestMatch.confidence = 'low';
      bestMatch.verified = false;
      bestMatch.note = 'En yüksek sayı Tutar olarak seçildi (Lütfen kontrol edin)';
    }
  }

  return bestMatch;
}

// Parse POS receipt / slip for Top-up (Avans Yükleme)
export function parseReceiptText(rawText) {
  console.log('[Receipt OCR Raw]:', rawText);

  // Look for "TOPLAM", "TUTAR", "TL"
  const lines = rawText.split('\n');
  let detectedAmount = null;
  let detectedDate = null;

  // Search date DD.MM.YYYY or DD/MM/YYYY
  const dateMatch = rawText.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  const timeMatch = rawText.match(/(\d{2}):(\d{2})/);

  if (dateMatch) {
    const day = dateMatch[1];
    const month = dateMatch[2];
    const year = dateMatch[3];
    const hour = timeMatch ? timeMatch[1] : '12';
    const minute = timeMatch ? timeMatch[2] : '00';
    detectedDate = `${year}-${month}-${day}T${hour}:${minute}`;
  }

  // Find lines with TOPLAM, TUTAR, SATIS
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.includes('TOPLAM') || upper.includes('TUTAR') || upper.includes('SATIŞ') || upper.includes('TL')) {
      const match = line.replace(/,/g, '.').match(/(\d+\.?\d*)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (val >= 50 && val <= 50000) {
          detectedAmount = val;
          break;
        }
      }
    }
  }

  // If not found by keyword, look for any reasonable currency number
  if (!detectedAmount) {
    const numbers = rawText
      .replace(/,/g, '.')
      .split(/\s+/)
      .map(t => parseFloat(t))
      .filter(n => !isNaN(n) && n >= 100 && n <= 50000);
    if (numbers.length > 0) {
      detectedAmount = Math.max(...numbers);
    }
  }

  return {
    amount: detectedAmount,
    date: detectedDate,
    rawText
  };
}

// Main OCR Execution function
export async function runOcr(imageSource, type = 'pump', onProgress) {
  try {
    const worker = await getWorker(onProgress);
    const result = await worker.recognize(imageSource);
    const text = result.data.text;

    if (type === 'pump') {
      return parsePumpText(text);
    } else {
      return parseReceiptText(text);
    }
  } catch (error) {
    console.error('OCR processing error:', error);
    throw error;
  }
}
