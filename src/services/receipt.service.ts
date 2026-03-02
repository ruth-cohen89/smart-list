import { normalizeName } from '../utils/normalize';
import type { OcrProvider } from '../types/ocr-provider';
import type { ReceiptRepository } from '../repositories/receipt.repository';
import type { ReceiptItem } from '../models/receipt.model';

const STOPWORDS = [
  // English
  'total',
  'subtotal',
  'tax',
  'vat',
  'cash',
  'credit',
  'change',
  'discount',
  'tip',
  'thank',
  'have a nice day',
  'date',
  'time',
  'receipt',
  'auth',
  'approval',
  // Hebrew — financial summary
  'סה"כ',
  'סכום',
  'לתשלום',
  'תשלום',
  'מע"מ',
  'מזומן',
  'אשראי',
  'עודף',
  'הנחה',
  'תודה',
  'יום טוב',
  'תאריך',
  'שעה',
  'קבלה',
  // Hebrew — transaction / store metadata
  'מספר אישור',
  'מספר עסקה',
  'קופה',
  'עובד',
  'חשבונית',
  'סניף',
  'טלפון',
  // Hebrew — OCR variants and additional financial terms
  'סהכ',
  'ביניים',
  'קניה',
  'עהיף',
];

// Bidi control characters injected by RTL OCR engines (LRM, RLM, LRE…PDI).
const BIDI_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

// Letters
const HAS_LETTERS_RE = /[a-zA-Z\u05D0-\u05EA]/;
const HAS_HEBREW_RE = /[\u05D0-\u05EA]/;

// --- Noise pattern guards ---
const STARS_RE = /\*{4}/; // credit card masking
const DATE_RE = /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/;
const ZERO_PRICE_LINE_RE = /^0[.,]00\s*₪?/;
const JUNK_CHARS_RE = /[()[\]:!@#$%^&]/;

// --- Barcode helpers ---
const BARCODE_ONLY_RE = /^\d{12,14}$/;

// --- Meta lines (store/transaction header/footer) ---
const META_HE_RE =
  /(קבלה|מספר|קופה|עובד|סניף|תאריך|שעה|טלפון|מע"מ|סה"כ|סהכ|לתשלום|אשראי|מזומן|עודף|כרטיס|חשבון|פריט|כמות|סה״כ|סה״כ לתשלום)/;
const META_EN_RE =
  /(receipt|date|time|cash|credit|subtotal|total|vat|tax|auth|approval|store|branch)/i;

function isMetaLine(line: string): boolean {
  return META_HE_RE.test(line) || META_EN_RE.test(line);
}

function stripBarcodes(line: string): string {
  // remove barcode-like tokens from within a line (keeps other text)
  return line
    .replace(/\b\d{12,14}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDiscountLine(line: string): boolean {
  // discount like "-2.30", "-6.00", "3.00-", "₪ -2.90"
  return /-\s*\d+(?:[.,]\d{2})|\d+(?:[.,]\d{2})\s*-/.test(line);
}

function isValidProductName(name: string): boolean {
  return name.length >= 2 && !JUNK_CHARS_RE.test(name);
}

// Strip bidi control chars, collapse whitespace.
function normalizeLine(line: string): string {
  return line.replace(BIDI_RE, '').replace(/\s+/g, ' ').trim();
}

function digitRatio(line: string): number {
  const nonSpace = line.replace(/\s/g, '');
  if (nonSpace.length === 0) return 0;
  const digitCount = (nonSpace.match(/\d/g) ?? []).length;
  return digitCount / nonSpace.length;
}

function extractQuantity(line: string): number | undefined {
  const m = line.match(/(\d+)\s*[xX×]|[xX×]\s*(\d+)/);
  if (!m) return undefined;
  const raw = m[1] ?? m[2];
  return raw !== undefined ? parseInt(raw, 10) : undefined;
}

// A common receipt item starts with an index/qty then text: "4 בייגלה...", "3 בסמטי..."
const ITEM_START_RE = /^\s*\d+\s+[a-zA-Z\u05D0-\u05EA]/;

// "space-decimal": 10 80 / 23 90 / 6 90
const SPACE_DECIMAL_RE = /(-?\d{1,3})\s(\d{2})(?!\d)/;

function parseSpaceDecimal(m: RegExpMatchArray): number {
  const a = m[1];
  const b = m[2];
  const sign = a.startsWith('-') ? -1 : 1;
  const intPart = Math.abs(parseInt(a, 10));
  const fracPart = parseInt(b, 10);
  return sign * (intPart + fracPart / 100);
}

/**
 * Price extraction tuned for your receipts:
 * 0) number followed by ₪ (e.g., "12.90₪", "12.9₪")
 * 1) explicit "₪ <number>" (integer or decimal)
 * 2) decimals with dot/comma: 10.80 / 23,90 / 10.8 / 23,9
 * 3) space-decimal ONLY if the line also has ₪ (prevents "90 90" noise)
 */
function extractPrice(line: string): { price: number | null; lineWithoutPrice: string } {
  // 0) number followed by ₪ (e.g., "12.90₪", "5₪", "12.9₪")
  const trailingShekels = [...line.matchAll(/(-?\d{1,4}(?:[.,]\d{1,2})?)\s*₪/g)];
  if (trailingShekels.length > 0) {
    const preferred =
      [...trailingShekels].reverse().find((m) => !m[1].trim().startsWith('-')) ??
      trailingShekels[trailingShekels.length - 1];

    const price = parseFloat(preferred[1].replace(',', '.'));
    const idx = preferred.index ?? -1;
    const before = idx >= 0 ? line.slice(0, idx) : '';
    const after = idx >= 0 ? line.slice(idx + preferred[0].length) : line;
    const lineWithoutPrice = (before + after).replace(/\s+/g, ' ').trim();
    return { price, lineWithoutPrice };
  }

  // 1) explicit ₪ before number
  const shekelMatches = [...line.matchAll(/₪\s*(-?\d{1,4}(?:[.,]\d{1,2})?)\b/g)];
  if (shekelMatches.length > 0) {
    const preferred =
      [...shekelMatches].reverse().find((m) => !m[1].trim().startsWith('-')) ??
      shekelMatches[shekelMatches.length - 1];

    const price = parseFloat(preferred[1].replace(',', '.'));
    const idx = preferred.index ?? -1;
    const before = idx >= 0 ? line.slice(0, idx) : '';
    const after = idx >= 0 ? line.slice(idx + preferred[0].length) : line;
    const lineWithoutPrice = (before + after).replace(/\s+/g, ' ').trim();
    return { price, lineWithoutPrice };
  }

  // 2) dot/comma decimals without ₪ (1 or 2 decimal digits)
  const decMatches = [...line.matchAll(/(-?\d{1,3}(?:[.,]\d{1,2}))/g)];
  if (decMatches.length > 0) {
    const preferred =
      [...decMatches].reverse().find((m) => !m[1].trim().startsWith('-')) ??
      decMatches[decMatches.length - 1];

    const price = parseFloat(preferred[1].replace(',', '.'));
    const idx = preferred.index ?? -1;
    const before = idx >= 0 ? line.slice(0, idx) : '';
    const after = idx >= 0 ? line.slice(idx + preferred[1].length) : line;
    const lineWithoutPrice = (before + after).replace(/\s+/g, ' ').trim();
    return { price, lineWithoutPrice };
  }

  // 3) space-decimal ONLY if ₪ exists in line
  if (line.includes('₪')) {
    const m = line.match(SPACE_DECIMAL_RE);
    if (m) {
      const price = parseSpaceDecimal(m);
      const idx = line.indexOf(m[0]);
      const before = idx >= 0 ? line.slice(0, idx) : '';
      const after = idx >= 0 ? line.slice(idx + m[0].length) : line;
      const lineWithoutPrice = (before + after).replace(/\s+/g, ' ').trim();
      return { price, lineWithoutPrice };
    }
  }

  return { price: null, lineWithoutPrice: line };
}

function cleanName(line: string): string {
  const { lineWithoutPrice } = extractPrice(line);

  let name = lineWithoutPrice
    .replace(/-\s*\d+(?:[.,]\d{2})|\d+(?:[.,]\d{2})\s*-/g, ' ')
    .replace(/\s*[xX×]\s*\d+|\s*\d+\s*[xX×]/g, ' ')
    .replace(/₪/g, ' ')
    .replace(/[§]/g, ' ')
    .replace(/\s*[.,:"'`]+\s*/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (HAS_HEBREW_RE.test(name)) {
    name = name
      .replace(/\b[a-zA-Z]{1,4}\b/g, ' ') // short latin junk
      .replace(/\b(?:NW|DUI|DON|NIN|OG|WN|WIRD)\b/gi, ' ') // common OCR junk
      .replace(/ט"?כ/g, ' ') // ט"כ
      .replace(/[^0-9\u05D0-\u05EA\s]/g, ' ') // keep mainly Hebrew + digits
      .replace(/\s+/g, ' ')
      .trim();
  }

  // small Hebrew stop fragments that ruin names
  name = name
    .replace(/\b(?:של)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return name;
}

function looksLikeRealName(name: string): boolean {
  if (!name) return false;
  if (!HAS_LETTERS_RE.test(name)) return false;
  if (!isValidProductName(name)) return false;
  if (isMetaLine(name)) return false;
  const lettersOnly = name.replace(/[^a-zA-Z\u05D0-\u05EA]/g, '');
  if (lettersOnly.length < 2) return false;
  // avoid extremely long “sentence” names
  if (name.length > 60) return false;
  return true;
}

/**
 * FINAL parseItems:
 * - startedItems prevents header pollution (photo receipts)
 * - ITEM_START_RE prevents merging two items into one
 * - closes item only when buffer exists and price is positive
 */
function parseItemsPrimary(rawText: string): ReceiptItem[] {
  const lines = rawText.split('\n').map(normalizeLine);

  const items: ReceiptItem[] = [];
  let nameBuffer = '';
  let startedItems = false;

  const pushItem = (price: number, lineForQty: string) => {
    const name = cleanName(nameBuffer);
    if (!looksLikeRealName(name)) return;

    const normalized = normalizeName(name);
    if (!normalized) return;

    items.push({
      name,
      normalizedName: normalized,
      quantity: extractQuantity(lineForQty),
      price,
    });

    nameBuffer = '';
  };

  for (const raw of lines) {
    if (!raw) continue;

    if (BARCODE_ONLY_RE.test(raw)) continue;

    const lowerRaw = raw.toLowerCase();
    if (STOPWORDS.some((w) => lowerRaw.includes(w))) continue;

    if (STARS_RE.test(raw) || DATE_RE.test(raw) || ZERO_PRICE_LINE_RE.test(raw)) continue;
    if (isMetaLine(raw)) continue;

    const line = stripBarcodes(raw);
    if (!line) continue;

    if (isDiscountLine(line)) continue;

    const { price } = extractPrice(line);

    // once we see a real positive price, we are in items zone
    if (price !== null && Number.isFinite(price) && price > 0) {
      startedItems = true;
    }

    // before items zone: do NOT accumulate names (prevents header => first product name)
    if (!startedItems) continue;

    // If this line clearly starts a new item and we already have a buffer,
    // then replace buffer instead of concatenating (prevents merging).
    if (ITEM_START_RE.test(line) && nameBuffer) {
      nameBuffer = cleanName(line);
    } else if (HAS_LETTERS_RE.test(line) && digitRatio(line) <= 0.55 && !isMetaLine(line)) {
      const cleaned = cleanName(line);
      if (looksLikeRealName(cleaned)) {
        nameBuffer = (nameBuffer ? `${nameBuffer} ${cleaned}` : cleaned).trim();
      }
    }

    // close item only if we have a buffer
    if (price !== null && Number.isFinite(price) && price > 0) {
      if (!nameBuffer) continue;
      pushItem(price, line);
    }
  }

  return items;
}

function parseItemsFallback(rawText: string): ReceiptItem[] {
  const lines = rawText.split('\n').map(normalizeLine);

  const prices: number[] = [];
  const names: string[] = [];

  for (const raw of lines) {
    if (!raw) continue;
    if (BARCODE_ONLY_RE.test(raw)) continue;
    if (STARS_RE.test(raw) || DATE_RE.test(raw) || ZERO_PRICE_LINE_RE.test(raw)) continue;
    if (isMetaLine(raw)) continue;

    const lowerRaw = raw.toLowerCase();
    if (STOPWORDS.some((w) => lowerRaw.includes(w))) continue;

    const line = stripBarcodes(raw);
    if (!line) continue;

    if (isDiscountLine(line)) continue;

    const { price } = extractPrice(line);
    if (price !== null && Number.isFinite(price) && price > 0) {
      prices.push(price);
      continue;
    }

    if (HAS_LETTERS_RE.test(line) && digitRatio(line) <= 0.55) {
      const name = cleanName(line);
      if (looksLikeRealName(name)) {
        names.push(name);
      }
    }
  }

  if (prices.length < 2 || names.length < 2) return [];

  const count = Math.min(prices.length, names.length);
  const items: ReceiptItem[] = [];
  for (let i = 0; i < count; i++) {
    const name = names[i];
    const normalized = normalizeName(name);
    if (!normalized) continue;
    items.push({ name, normalizedName: normalized, price: prices[i] });
  }
  return items;
}

export function parseItems(rawText: string): ReceiptItem[] {
  const primary = parseItemsPrimary(rawText);
  if (primary.length > 0) return primary;
  return parseItemsFallback(rawText);
}

export class ReceiptService {
  constructor(
    private readonly ocrProvider: OcrProvider,
    private readonly receiptRepo: ReceiptRepository,
  ) {}

  async uploadReceipt(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ receiptId: string; items: ReceiptItem[] }> {
    const { rawText } = await this.ocrProvider.extractText(file.buffer);
    console.debug('[ReceiptService] rawText (first 500 chars):', rawText.slice(0, 500));

    const items = parseItems(rawText);
    const receipt = await this.receiptRepo.createReceipt({ userId, rawText, items });

    return { receiptId: receipt.id, items: receipt.items };
  }
}
