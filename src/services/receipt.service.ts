import { normalizeName } from '../utils/normalize';
import type { OcrProvider } from '../types/ocr-provider';
import type { ReceiptRepository } from '../repositories/receipt.repository';
import type { Receipt, ReceiptItem, ReceiptItemInput } from '../models/receipt.model';
import { AppError } from '../errors/app-error';

/**
 * Feature flags:
 * - Default: do NOT extract prices (names-first). You can enable via env.
 *   RECEIPT_EXTRACT_PRICES=true
 */
const ENABLE_PRICE_EXTRACTION = process.env.RECEIPT_EXTRACT_PRICES === 'true';

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
  'סהייכ',
  'סהיכ',
  'מעמ',
  'ביניים',
  'קניה',
  'עהיף',
];

const BIDI_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

// Letters
const HAS_LETTERS_RE = /[a-zA-Z\u05D0-\u05EA]/;
const HAS_HEBREW_RE = /[\u05D0-\u05EA]/;

// --- Noise pattern guards ---
const STARS_RE = /\*{4}/;
const DATE_RE = /\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/;
const ZERO_PRICE_LINE_RE = /^0[.,]00\s*₪?/;
const JUNK_CHARS_RE = /[()[\]:!@#$%^&]/;

// --- Barcode helpers ---
const BARCODE_ONLY_RE = /^\d{12,14}$/;

// Table header signals
const ITEM_TABLE_HEADER_RE = /(תיאור|מחיר|כמות|קוד\s*פריט|קוד\s*מוצר|ברקוד|סה"כ|סה״כ|לתשלום|לתשלם)/;

const HEADER_EXACT_TERMS = [
  'תיאור',
  'קוד פריט',
  'קוד מוצר',
  'כמות',
  'מחיר',
  'סהכ',
  'סה"כ',
  'סה״כ',
  'כמות מחיר',
  'כמות * מחיר',
  'מספר',
  'סוג',
  'רגיל',
  'מקור',
  'לכבוד',
  'לבור',
  'נוקור',
  'חברה',
  'אמצעי תשלום',
];

const UNIT_ONLY_RE = /^(?:ליח|יח|יח׳|יח'|לקג|לק"ג|קג|ק"ג|לקייג)$/i;
const PRICE_ONLY_RE = /^₪?\s*-?\d{1,4}(?:[.,]\d{1,2})?\s*₪?$/;
const WEIGHT_NAME_RE = /^\d+(?:[.,]\d{1,3})\s+(.+)$/;
const PURE_NUMERIC_LINE_RE = /^[\d\s.,₪/*xX×-]+$/;
const PROMO_HINT_RE = /(מבצע|הנחת|זיכוי|פיקדון|חסכת|כולל|מוגבל|מעל\s+\d|ב\d)/;
const PRODUCT_WORD_HINT_RE =
  /(עוף|שוקולד|לחם|שום|בצל|בטעם|גבינת|גבינה|שמנת|מארז|דו|כפול|מגבות|ממחטות|משקה|אנרגיה|עוגת|שמרים|יין|רזרב|גולד|קברנה|לימון|אבוקדו|בטטה|קישוא|פריכיות|דוריטוס|בייגלה|צדר|יוגטה|שניצל|לבבות|דובונים|אגרול|חטיף|חלב|גאודה|רביעיה|סודה|מקסי|תפוצ|אצבעות)/;

// --- Additional guards for header/start detection ---
const MONEY_RE = /\d{1,4}[.,]\d{1,2}/;
const ADDRESS_RE =
  /(ירושלים|תל אביב|תלאביב|חיפה|רח['"]?|רחוב|בע"מ|בעמ|טלפון|תאריך מסמך|חשבורית|חשבונית|קופה|עובד|מס[./]?\s*קבלה|מסמך)/i;

function normalizeForStopword(s: string): string {
  return s
    .replace(BIDI_RE, '')
    .replace(/[\u05F4\u05F3\u0022\u0027\u201C\u201D\u2018\u2019״׳"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const _normalizedStopwords = STOPWORDS.map(normalizeForStopword);
const _normalizedHeaderTerms = HEADER_EXACT_TERMS.map(normalizeForStopword);

function hasStopword(line: string): boolean {
  const norm = normalizeForStopword(line);
  return _normalizedStopwords.some((w) => norm.includes(w));
}

const META_HE_RE =
  /(קבלה|מספר|קופה|עובד|סניף|תאריך|שעה|טלפון|מע"מ|מעמ|בעמ|סה"כ|סה״כ|סהכ|סהייכ|סהיכ|לתשלום|לתשלם|אשראי|מזומן|עודף|כרטיס|חשבון|פריט|כמות)/;
const META_EN_RE =
  /(receipt|date|time|cash|credit|subtotal|total|vat|tax|auth|approval|store|branch)/i;

function isMetaLine(line: string): boolean {
  if (META_HE_RE.test(line) || META_EN_RE.test(line)) return true;
  const norm = normalizeForStopword(line);
  return META_HE_RE.test(norm) || META_EN_RE.test(norm);
}

function stripBarcodes(line: string): string {
  return line
    .replace(/\b\d{12,14}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDiscountLine(line: string): boolean {
  return /-\s*\d+(?:[.,]\d{2})|\d+(?:[.,]\d{2})\s*-/.test(line);
}

function isValidProductName(name: string): boolean {
  return name.length >= 2 && !JUNK_CHARS_RE.test(name);
}

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type MulResult =
  | { kind: 'weight'; unitPrice: number; weightKg: number; finalPrice: number }
  | { kind: 'qty'; qty: number; unitPrice: number; finalPrice: number };

function extractMultiplyLine(line: string): MulResult | null {
  const m = line.match(/(\d+(?:[.,]\d+)?)\s*[*×]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const a = parseFloat(m[1].replace(',', '.'));
  const b = parseFloat(m[2].replace(',', '.'));

  const aIsInt = Number.isInteger(a) && a >= 1 && a <= 20;
  const bIsInt = Number.isInteger(b) && b >= 1 && b <= 20;
  if (aIsInt && !bIsInt) return { kind: 'qty', qty: a, unitPrice: b, finalPrice: round2(a * b) };
  if (bIsInt && !aIsInt) return { kind: 'qty', qty: b, unitPrice: a, finalPrice: round2(a * b) };

  const [unitPrice, weightKg] = a > b ? [a, b] : [b, a];
  if (weightKg > 5 || weightKg < 0.01) return null;
  if (unitPrice < 0.5) return null;
  return { kind: 'weight', unitPrice, weightKg, finalPrice: round2(unitPrice * weightKg) };
}

function isPromoLine(line: string): boolean {
  if (/מבצע|הנחת|זיכוי/.test(line)) return true;
  if (/(\d+[.,]\d{2})\s*-\s*$/.test(line)) return true;
  if (/₪\s*-\d/.test(line)) return true;
  return false;
}

function extractStandaloneQty(segment: string[]): number | undefined {
  for (let k = 0; k < segment.length; k++) {
    const m = segment[k].match(/^(\d{1,2})$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n < 1 || n > 20) continue;
    const prev = k > 0 ? segment[k - 1] : '';
    const next = k < segment.length - 1 ? segment[k + 1] : '';
    if (/יח|ליח/.test(prev) || /יח|ליח/.test(next)) return n;
  }
  return undefined;
}

const SPACE_DECIMAL_RE = /(-?\d{1,3})\s(\d{2})(?!\d)/;

function parseSpaceDecimal(m: RegExpMatchArray): number {
  const a = m[1];
  const b = m[2];
  const sign = a.startsWith('-') ? -1 : 1;
  const intPart = Math.abs(parseInt(a, 10));
  const fracPart = parseInt(b, 10);
  return sign * (intPart + fracPart / 100);
}

function hasMoneyToken(line: string): boolean {
  return MONEY_RE.test(line) || /₪/.test(line);
}

function looksLikeStoreHeader(line: string): boolean {
  const norm = normalizeForStopword(line);

  if (!norm) return true;
  if (ADDRESS_RE.test(line)) return true;

  if (
    /(מחסני|השוק|סופר|סניף|ירושלים|קופה|עובד|חשבורית|חשבונית|תאריך|טלפון|בעמ|מספר\s*עסקה|מספר\s*אישור)/i.test(
      norm,
    )
  ) {
    return true;
  }

  return false;
}

function extractPrice(line: string): { price: number | null; lineWithoutPrice: string } {
  if (!ENABLE_PRICE_EXTRACTION) {
    return { price: null, lineWithoutPrice: line };
  }

  const leadingShekels = line.match(/^₪\s*(-?\d{1,4}(?:[.,]\d{1,2})?)/);
  if (leadingShekels) {
    const price = parseFloat(leadingShekels[1].replace(',', '.'));
    const lineWithoutPrice = line.slice(leadingShekels[0].length).replace(/\s+/g, ' ').trim();
    return { price, lineWithoutPrice };
  }

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

  const decMatches = [...line.matchAll(/(-?\d{1,3}(?:[.,]\d{1,2}))/g)];
  if (decMatches.length > 0) {
    const isMulLine = decMatches.length > 1 && /[*×]|\b[xX]\b/.test(line);
    let preferred: RegExpMatchArray;
    if (isMulLine) {
      const nonNeg = [...decMatches].filter((m) => !m[1].trim().startsWith('-'));
      preferred = (nonNeg.length > 0 ? nonNeg : decMatches).reduce((a, b) =>
        parseFloat(a[1].replace(',', '.')) >= parseFloat(b[1].replace(',', '.')) ? a : b,
      );
    } else {
      preferred =
        [...decMatches].reverse().find((m) => !m[1].trim().startsWith('-')) ??
        decMatches[decMatches.length - 1];
    }

    const price = parseFloat(preferred[1].replace(',', '.'));
    const idx = preferred.index ?? -1;
    const before = idx >= 0 ? line.slice(0, idx) : '';
    const after = idx >= 0 ? line.slice(idx + preferred[1].length) : line;
    const lineWithoutPrice = (before + after).replace(/\s+/g, ' ').trim();
    return { price, lineWithoutPrice };
  }

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
      .replace(/\b[a-zA-Z]{1,4}\b/g, ' ')
      .replace(/\b(?:NW|DUI|DON|NIN|OG|WN|WIRD|NO)\b/gi, ' ')
      .replace(/ט"?כ/g, ' ')
      .replace(/[^0-9\u05D0-\u05EA\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  name = name
    .replace(/\b(?:של)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return name;
}

function looksLikeHeaderOrMetaExact(line: string): boolean {
  const norm = normalizeForStopword(cleanName(line));
  if (!norm) return true;
  return _normalizedHeaderTerms.includes(norm);
}

function isLikelyUnitOnly(line: string): boolean {
  const norm = normalizeForStopword(line);
  return UNIT_ONLY_RE.test(norm);
}

function isLikelyPriceOnly(line: string): boolean {
  const stripped = normalizeLine(line).replace(/\s+/g, '');
  return PRICE_ONLY_RE.test(stripped) || PURE_NUMERIC_LINE_RE.test(stripped);
}

function isLikelyMetaOrNoise(line: string): boolean {
  if (!line) return true;
  if (BARCODE_ONLY_RE.test(line)) return true;
  if (STARS_RE.test(line) || DATE_RE.test(line) || ZERO_PRICE_LINE_RE.test(line)) return true;
  if (looksLikeHeaderOrMetaExact(line)) return true;
  if (isLikelyUnitOnly(line)) return true;
  if (isPromoLine(line) || PROMO_HINT_RE.test(line)) return true;
  if (hasStopword(line) || isMetaLine(line)) return true;
  if (isDiscountLine(line)) return true;
  if (isLikelyPriceOnly(line)) return true;
  return false;
}

function isStrongTotalsBoundary(line: string): boolean {
  const norm = normalizeForStopword(line);
  if (!norm) return false;

  const paymentish =
    /(לתשלום|לתשלם|אמצעי|אשראי|מזומן|עודף|מעמ|חשבון|שלום|לחשלום|subtotal|total|change|credit|cash)/i.test(
      norm,
    );

  const totalish = /(סהכ|סהייכ|סהיכ)/i.test(norm);
  const hasMoney = /\d{1,4}[.,]\d{1,2}/.test(line);

  if (paymentish && (hasMoney || totalish)) return true;
  if (/^(?:לחשלום|לתשלום|לתשלם)$/.test(norm)) return true;
  if (totalish && /(אמצעי|אשראי|מזומן|חשבון|שלום)/.test(norm)) return true;

  return false;
}

function maybeExtractWeightedName(line: string): string | null {
  const m = normalizeLine(line).match(WEIGHT_NAME_RE);
  if (!m) return null;
  const candidate = cleanName(m[1]);
  if (!candidate) return null;
  if (digitRatio(candidate) > 0.35) return null;
  if (!looksLikeRealName(candidate)) return null;
  return candidate;
}

function scoreProductCandidate(
  line: string,
  opts?: { nearBarcode?: boolean; distance?: number; allowWeightedPrefix?: boolean },
): number {
  const normalized = normalizeLine(line);
  if (!normalized) return -1000;

  const cleaned = cleanName(normalized);
  if (!cleaned) return -1000;

  if (looksLikeHeaderOrMetaExact(cleaned)) return -1000;
  if (isLikelyMetaOrNoise(normalized)) return -1000;
  if (looksLikeStoreHeader(normalized)) return -1000;

  let score = 0;

  if (HAS_HEBREW_RE.test(cleaned)) score += 6;
  if (HAS_LETTERS_RE.test(cleaned)) score += 2;

  const hebrewLetters = cleaned.replace(/[^\u05D0-\u05EA]/g, '').length;
  const words = cleaned.split(/\s+/).filter(Boolean);
  score += Math.min(hebrewLetters, 10);
  score += Math.min(words.length, 4);

  if (cleaned.length >= 5 && cleaned.length <= 40) score += 4;
  if (PRODUCT_WORD_HINT_RE.test(cleaned)) score += 5;
  if (opts?.allowWeightedPrefix && maybeExtractWeightedName(normalized)) score += 5;

  const ratio = digitRatio(normalized);
  if (ratio < 0.25) score += 4;
  else if (ratio < 0.4) score += 1;
  else score -= 5;

  if (opts?.nearBarcode) score += 4;
  if (typeof opts?.distance === 'number') score += Math.max(0, 4 - opts.distance);

  if (/^מבצע/.test(normalized)) score -= 20;
  if (cleaned.length > 55) score -= 5;
  if (JUNK_CHARS_RE.test(normalized)) score -= 3;

  return score;
}

function looksLikeRealName(name: string): boolean {
  if (!name) return false;
  if (name.length < 3) return false;
  if (!HAS_LETTERS_RE.test(name)) return false;
  if (!isValidProductName(name)) return false;
  if (looksLikeHeaderOrMetaExact(name)) return false;
  if (isMetaLine(name)) return false;
  if (hasStopword(name)) return false;
  if (looksLikeStoreHeader(name)) return false;

  const hebrewLetters = name.replace(/[^\u05D0-\u05EA]/g, '');
  if (HAS_HEBREW_RE.test(name) && hebrewLetters.length < 2) return false;

  const lettersOnly = name.replace(/[^a-zA-Z\u05D0-\u05EA]/g, '');
  if (lettersOnly.length < 2) return false;

  if (digitRatio(name) > 0.45) return false;
  if (name.length > 60) return false;

  return true;
}

function isProductLikeLine(line: string): boolean {
  const cleaned = cleanName(line);
  if (!cleaned) return false;
  if (!looksLikeRealName(cleaned)) return false;
  if (looksLikeStoreHeader(line)) return false;
  if (isLikelyMetaOrNoise(line)) return false;

  const hasProductHint = PRODUCT_WORD_HINT_RE.test(cleaned);
  const hasMoney = hasMoneyToken(line);
  const hasMul = !!extractMultiplyLine(line);
  const weighted = !!maybeExtractWeightedName(line);

  if (hasMoney || hasMul || weighted || hasProductHint) return true;

  return false;
}

function findPrimaryStartIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue;
    if (ITEM_TABLE_HEADER_RE.test(normalizeForStopword(raw))) {
      return i + 1;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (BARCODE_ONLY_RE.test(lines[i])) {
      return Math.max(0, i - 1);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue;
    if (looksLikeStoreHeader(raw)) continue;
    if (isLikelyMetaOrNoise(raw)) continue;
    if (isProductLikeLine(raw)) return i;
  }

  return 0;
}

function pushUniqueNameOnlyItem(
  items: ReceiptItemInput[],
  seen: Set<string>,
  rawName: string,
  quantity?: number,
): void {
  const name = cleanName(rawName);
  if (!looksLikeRealName(name)) return;

  const normalized = normalizeName(name);
  if (!normalized) return;

  const dupKey = `${normalized}|${quantity ?? ''}`;
  if (seen.has(dupKey)) return;

  seen.add(dupKey);
  items.push({
    name,
    normalizedName: normalized,
    quantity,
  });
}

function findBestDigitalCandidateNearBarcode(
  lines: string[],
  barcodeIdx: number,
): string | undefined {
  let bestLine: string | undefined;
  let bestScore = -1000;

  const start = Math.max(0, barcodeIdx - 6);
  const end = Math.min(lines.length - 1, barcodeIdx + 3);

  for (let j = start; j <= end; j++) {
    if (j === barcodeIdx) continue;
    const raw = lines[j];
    if (!raw) continue;
    if (isStrongTotalsBoundary(raw)) continue;

    const score = scoreProductCandidate(raw, {
      nearBarcode: true,
      distance: Math.abs(j - barcodeIdx),
      allowWeightedPrefix: true,
    });

    if (score > bestScore) {
      bestScore = score;
      bestLine = raw;
    }
  }

  if (bestScore < 9) return undefined;

  const weighted = bestLine ? maybeExtractWeightedName(bestLine) : null;
  return weighted ?? (bestLine ? cleanName(bestLine) : undefined);
}

function extractLooseDigitalNames(
  lines: string[],
  seenNormalized: Set<string>,
): ReceiptItemInput[] {
  const items: ReceiptItemInput[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue;
    if (isStrongTotalsBoundary(raw)) break;
    if (isLikelyMetaOrNoise(raw)) continue;
    if (looksLikeStoreHeader(raw)) continue;

    let candidate: string | null = maybeExtractWeightedName(raw);
    if (!candidate) {
      const score = scoreProductCandidate(raw, { allowWeightedPrefix: true });
      if (score >= 10) candidate = cleanName(raw);
    }

    if (!candidate || !looksLikeRealName(candidate)) continue;

    const normalized = normalizeName(candidate);
    if (!normalized) continue;
    if (seenNormalized.has(normalized)) continue;

    seenNormalized.add(normalized);
    items.push({
      name: candidate,
      normalizedName: normalized,
    });
  }

  return items;
}

/**
 * Block-based parser for DIGITAL receipts.
 * Names-first when prices are disabled:
 * - barcode neighborhood scoring (before + after barcode)
 * - extra loose scan for weighted produce / non-barcode item lines
 */
function parseItemsDigital(rawText: string): ReceiptItemInput[] {
  const text = rawText.replace(/₪₪/g, '₪');
  const lines = text.split('\n').map(normalizeLine).filter(Boolean);

  const items: ReceiptItemInput[] = [];
  const seenKeys = new Set<string>();
  const seenNormalized = new Set<string>();

  interface PriceCandidate {
    lineIdx: number;
    price: number;
    isShekels: boolean;
  }
  const pricePool: PriceCandidate[] = [];
  const usedLineIdxs = new Set<number>();

  if (ENABLE_PRICE_EXTRACTION) {
    for (let idx = 0; idx < lines.length; idx++) {
      const bl = lines[idx];
      if (isStrongTotalsBoundary(bl)) break;
      if (BARCODE_ONLY_RE.test(bl)) continue;
      if (HAS_LETTERS_RE.test(bl)) continue;
      if (STARS_RE.test(bl) || DATE_RE.test(bl)) continue;
      if (isPromoLine(bl)) continue;
      const { price } = extractPrice(bl);
      if (price !== null && price > 0 && price < 500) {
        pricePool.push({ lineIdx: idx, price, isShekels: /^₪/.test(bl) });
      }
    }
  }

  let lastBarcodeIdx = -1;
  let segmentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (isStrongTotalsBoundary(raw)) break;
    if (!BARCODE_ONLY_RE.test(raw)) continue;

    const prevBarcodeIdx = lastBarcodeIdx;
    lastBarcodeIdx = i;

    const segment = lines.slice(prevBarcodeIdx + 1, i);
    const explicitQty = extractStandaloneQty(segment);
    let qty: number | undefined = explicitQty;

    let productName = findBestDigitalCandidateNearBarcode(lines, i);

    if (!productName) {
      for (let k = segment.length - 1; k >= 0; k--) {
        if (looksLikeStoreHeader(segment[k])) continue;
        const candidate = maybeExtractWeightedName(segment[k]) ?? cleanName(segment[k]);
        if (looksLikeRealName(candidate) && !isLikelyMetaOrNoise(segment[k])) {
          productName = candidate;
          break;
        }
      }
    }

    if (!productName) continue;

    const normalized = normalizeName(productName);
    if (!normalized) continue;

    if (!ENABLE_PRICE_EXTRACTION) {
      const dupKey = `${normalized}|${qty ?? ''}`;
      if (seenKeys.has(dupKey)) continue;

      const key = `${normalized}|seg:${segmentIndex++}`;
      seenKeys.add(key);
      seenKeys.add(dupKey);
      seenNormalized.add(normalized);

      items.push({
        name: productName,
        normalizedName: normalized,
        quantity: qty,
      });
      continue;
    }

    let totalPrice: number | undefined;
    for (const bl of segment) {
      const m = bl.match(/^₪(\d+(?:[.,]\d{1,2})?)/);
      if (!m) continue;
      const p = parseFloat(m[1].replace(',', '.'));
      if (p > 0 && (totalPrice === undefined || p > totalPrice)) totalPrice = p;
    }

    let unitPrice: number | undefined;
    for (const bl of segment) {
      if (/^₪/.test(bl)) continue;
      if (HAS_LETTERS_RE.test(bl)) continue;
      if (BARCODE_ONLY_RE.test(bl)) continue;
      if (isPromoLine(bl)) continue;
      const { price } = extractPrice(bl);
      if (price !== null && price > 0) {
        unitPrice = price;
        break;
      }
    }

    let priceSource = 'none';
    if (totalPrice === undefined && unitPrice === undefined) {
      for (let pi = pricePool.length - 1; pi >= 0; pi--) {
        const cand = pricePool[pi];
        if (cand.lineIdx >= i) continue;
        if (usedLineIdxs.has(cand.lineIdx)) continue;
        unitPrice = cand.price;
        priceSource = cand.isShekels ? 'pool_shekel' : 'pool_numeric';
        usedLineIdxs.add(cand.lineIdx);
        console.debug(
          `[parseItemsDigital] pool backfill: barcode[${i}]="${raw}" price=${unitPrice} from line[${cand.lineIdx}]="${lines[cand.lineIdx]}" source=${priceSource}`,
        );
        break;
      }
    }

    let finalPrice: number | undefined;
    if (totalPrice !== undefined) {
      finalPrice = totalPrice;
      if (priceSource === 'none') priceSource = 'segment_total';
    } else if (unitPrice !== undefined) {
      finalPrice = explicitQty !== undefined ? round2(unitPrice * explicitQty) : unitPrice;
      if (priceSource === 'none') {
        priceSource = explicitQty !== undefined ? 'segment_unit_x_qty' : 'segment_unit';
      }
    }

    if (!finalPrice || finalPrice <= 0) continue;

    if (qty === undefined && unitPrice && unitPrice > 0) {
      const ratio = finalPrice / unitPrice;
      const rounded = Math.round(ratio);
      if (rounded >= 2 && rounded <= 20 && Math.abs(ratio - rounded) <= 0.03) {
        qty = rounded;
      }
    }

    const dedupeKey = `${normalized}|${finalPrice}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    items.push({
      name: productName,
      normalizedName: normalized,
      quantity: qty,
      price: finalPrice,
    });
  }

  if (!ENABLE_PRICE_EXTRACTION) {
    const extra = extractLooseDigitalNames(lines, seenNormalized);
    items.push(...extra);
  }

  return items;
}

/**
 * PHOTO/HYBRID parser.
 * Names-first mode:
 * - starts from a safer product/table/barcode boundary
 * - avoids collecting store header lines as products
 * - supports weighted prefix lines like "0.96 אבוקדו"
 */
function parseItemsPrimary(rawText: string): ReceiptItemInput[] {
  const lines = rawText.split('\n').map(normalizeLine).filter(Boolean);

  const items: ReceiptItemInput[] = [];
  const seen = new Set<string>();

  const startIndex = findPrimaryStartIndex(lines);
  let currentPageLines: Set<string> = new Set();
  const linesSeenByPage: Map<string, number> = new Map();

  const pushNameOnly = (rawLine: string) => {
    const candidate = maybeExtractWeightedName(rawLine) ?? cleanName(rawLine);
    if (!looksLikeRealName(candidate)) return;

    const normalized = normalizeName(candidate);
    if (!normalized) return;

    const qty = extractQuantity(rawLine);
    pushUniqueNameOnlyItem(items, seen, candidate, qty);
  };

  const pushPriced = (rawLine: string) => {
    const candidate = maybeExtractWeightedName(rawLine) ?? cleanName(rawLine);
    if (!looksLikeRealName(candidate)) return;

    const normalized = normalizeName(candidate);
    if (!normalized) return;

    const { price } = extractPrice(rawLine);
    const qty = extractQuantity(rawLine);
    const dupKey = `${normalized}|${price ?? ''}|${qty ?? ''}`;

    if (seen.has(dupKey)) return;
    seen.add(dupKey);

    const mulData = /^₪/.test(rawLine) ? null : extractMultiplyLine(rawLine);

    items.push({
      name: candidate,
      normalizedName: normalized,
      quantity: mulData?.kind === 'qty' ? mulData.qty : qty,
      ...(mulData ? { price: mulData.finalPrice } : price !== null && price > 0 ? { price } : {}),
    });
  };

  for (let idx = startIndex; idx < lines.length; idx++) {
    const raw = lines[idx];
    if (!raw) continue;

    if (/^---\s*PAGE\s+\d+\s*---$/.test(raw)) {
      for (const prev of currentPageLines) {
        linesSeenByPage.set(prev, (linesSeenByPage.get(prev) ?? 0) + 1);
      }
      currentPageLines = new Set();
      continue;
    }

    if (raw.length > 120) continue;
    if (STARS_RE.test(raw) || DATE_RE.test(raw) || ZERO_PRICE_LINE_RE.test(raw)) continue;

    if (isStrongTotalsBoundary(raw)) break;

    const normRaw = normalizeForStopword(raw);
    currentPageLines.add(normRaw);

    if ((linesSeenByPage.get(normRaw) ?? 0) >= 1 && (isMetaLine(raw) || hasStopword(raw))) {
      continue;
    }

    if (looksLikeStoreHeader(raw)) continue;
    if (looksLikeHeaderOrMetaExact(raw)) continue;
    if (BARCODE_ONLY_RE.test(raw)) continue;
    if (isLikelyMetaOrNoise(raw)) continue;

    if (!ENABLE_PRICE_EXTRACTION) {
      if (!isProductLikeLine(raw)) continue;
      pushNameOnly(raw);
      continue;
    }

    if (!isProductLikeLine(raw) && !hasMoneyToken(raw)) continue;
    pushPriced(raw);
  }

  return items;
}

function parseItemsFallback(rawText: string): ReceiptItemInput[] {
  const lines = rawText.split('\n').map(normalizeLine);

  const prices: number[] = [];
  const names: string[] = [];

  for (const raw of lines) {
    if (!raw) continue;
    if (BARCODE_ONLY_RE.test(raw)) continue;
    if (STARS_RE.test(raw) || DATE_RE.test(raw) || ZERO_PRICE_LINE_RE.test(raw)) continue;
    if (isStrongTotalsBoundary(raw)) break;
    if (isMetaLine(raw)) continue;
    if (hasStopword(raw)) continue;
    if (looksLikeStoreHeader(raw)) continue;

    const line = stripBarcodes(raw);
    if (!line) continue;
    if (isDiscountLine(line)) continue;

    if (!ENABLE_PRICE_EXTRACTION) {
      const weighted = maybeExtractWeightedName(line);
      if (weighted) {
        names.push(weighted);
        continue;
      }

      if (
        HAS_LETTERS_RE.test(line) &&
        digitRatio(line) <= 0.55 &&
        !isLikelyMetaOrNoise(line) &&
        !looksLikeStoreHeader(line)
      ) {
        const name = cleanName(line);
        if (looksLikeRealName(name)) names.push(name);
      }
      continue;
    }

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

  if (!ENABLE_PRICE_EXTRACTION) {
    if (names.length < 2) return [];
    return names
      .map((name) => {
        const normalized = normalizeName(name);
        if (!normalized) return null;
        return { name, normalizedName: normalized } satisfies ReceiptItemInput;
      })
      .filter((x): x is ReceiptItemInput => x !== null);
  }

  if (prices.length < 2 || names.length < 2) return [];

  const count = Math.min(prices.length, names.length);
  const items: ReceiptItemInput[] = [];
  for (let i = 0; i < count; i++) {
    const name = names[i];
    const normalized = normalizeName(name);
    if (!normalized) continue;
    items.push({ name, normalizedName: normalized, price: prices[i] });
  }
  return items;
}

export function parseItems(rawText: string): ReceiptItemInput[] {
  const kind = detectReceiptKind(rawText);
  const hasLeadingShekels = /^₪{1,2}\d/m.test(rawText);

  if (kind === 'DIGITAL' || (hasLeadingShekels && kind !== 'PHOTO')) {
    const digital = parseItemsDigital(rawText);
    if (digital.length > 0) return digital;
  }

  const primary = parseItemsPrimary(rawText);
  if (primary.length > 0) return primary;

  return parseItemsFallback(rawText);
}

// ─── Post-processing ──────────────────────────────────────────────────────────

function normalizeForPost(s: string): string {
  return s
    .replace(BIDI_RE, '')
    .replace(/[\u05F4\u05F3\u0022\u0027\u201C\u201D\u2018\u2019״׳"'.,:]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

const POST_META_TERMS: string[] = [
  'לתשלום',
  'לתשלם',
  'תשלום',
  'אמצעי',
  'אשראי',
  'מזומן',
  'עודף',
  'סהכ',
  'סכום',
  'ביניים',
  'מעמ',
  'חשבון',
  'קופה',
  'סניף',
  'חשבונית',
  'אישור',
  'עסקה',
  'תאריך',
  'שעה',
  'סהיכ',
  'סהייכ',
  'עהיכ',
  'לחשלום',
  'רגיל',
  'מקור',
  'לכבוד',
  'לבור',
  'נוקור',
  'תיאור',
  'קודפריט',
  'כמות',
  'מחיר',
  'חברה',
  'מספר',
  'סוג',
  'total',
  'subtotal',
  'vat',
  'tax',
  'cash',
  'credit',
  'change',
  'approval',
  'auth',
  'receipt',
  'date',
  'time',
].map(normalizeForPost);

function isPostMeta(name: string): boolean {
  const norm = normalizeForPost(name);
  return POST_META_TERMS.some((t) => norm === t || norm.includes(t));
}

export function detectReceiptKind(rawText: string): 'DIGITAL' | 'PHOTO' | 'HYBRID' {
  let score = 0;

  const barcodes = (rawText.match(/\b729\d{9,11}\b/g) ?? []).length;
  if (barcodes >= 3) score += 3;
  else if (barcodes >= 1) score += 1;
  if (/ליח|יח[׳']/.test(rawText)) score += 2;

  const mulLines = (rawText.match(/\d+[.,]\d+\s*[*×]\s*\d+[.,]\d+/g) ?? []).length;
  if (mulLines >= 2) score -= 2;
  else if (mulLines >= 1) score -= 1;

  if (score >= 3) return 'DIGITAL';
  if (score <= -2) return 'PHOTO';
  return 'HYBRID';
}

export function postProcessItems(items: ReceiptItemInput[], rawText: string): ReceiptItemInput[] {
  const kind = detectReceiptKind(rawText);

  let result = items
    .filter((item) => !isPostMeta(item.name))
    .filter((item) => looksLikeRealName(item.name))
    .filter((item) => !isLikelyMetaOrNoise(item.name))
    .filter((item) => !looksLikeStoreHeader(item.name));

  result = result.filter((item) => {
    const hebrewLetters = item.name.replace(/[^\u05D0-\u05EA]/g, '');
    if (hebrewLetters.length > 0) return hebrewLetters.length >= 2;
    return item.name.length >= 4;
  });

  result = result.filter((item) => {
    const norm = normalizeForPost(item.name);
    if (/(מחסניהשוק|ההגנה|ירושלים|קופה|עובד|תאריך|מסמך|טלפון|בעמ|לכבוד|חברה|מספר|סוג)/.test(norm)) {
      return false;
    }
    return true;
  });

  if (kind === 'DIGITAL') {
    const merged: ReceiptItemInput[] = [];
    for (let i = 0; i < result.length; i++) {
      if (normalizeForPost(result[i].name) === 'לקג' && i + 1 < result.length) {
        const next = result[i + 1];
        const newName = `לק ג ${next.name}`;
        merged.push({
          ...next,
          name: newName,
          normalizedName: normalizeName(newName) || next.normalizedName,
        });
        i++;
      } else {
        merged.push(result[i]);
      }
    }
    result = merged;

    if (ENABLE_PRICE_EXTRACTION) {
      result = result.filter((item) => !(item.name.includes('פיקדון') && (item.price ?? 0) <= 1.5));

      result = result.filter((item) => {
        const norm = normalizeForPost(item.name);
        const isPromo = ['מבצע', 'הנחת', 'זיכוי'].some((kw) => norm.includes(normalizeForPost(kw)));
        return !(isPromo && (item.price ?? 0) <= 6);
      });
    }
  }

  result = result.filter((item, i, arr) => {
    if (i === 0) return true;
    const prev = arr[i - 1];

    if (!ENABLE_PRICE_EXTRACTION) {
      if (item.normalizedName !== prev.normalizedName) return true;

      const prevQty = prev.quantity ?? null;
      const currQty = item.quantity ?? null;
      return prevQty !== currQty;
    }

    return !(item.normalizedName === prev.normalizedName && item.price === prev.price);
  });

  return result;
}

export class ReceiptService {
  constructor(
    private readonly ocrProvider: OcrProvider,
    private readonly receiptRepo: ReceiptRepository,
  ) {}

  async getReceiptById(userId: string, receiptId: string): Promise<{ receipt: Receipt }> {
    const receipt = await this.receiptRepo.findByIdAndUser(receiptId, userId);
    if (!receipt) {
      throw new AppError('Receipt not found', 404);
    }

    return { receipt };
  }
  async uploadReceipt(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<{ receiptId: string; items: ReceiptItem[] }> {
    const rawParts: string[] = [];

    for (const file of files) {
      console.debug(
        '[ReceiptService] processing file:',
        file.originalname,
        file.mimetype,
        file.size,
      );

      const isPdf =
        file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const { extractPdfTextLayer, pdfToImageBuffers } =
          await import('../infrastructure/pdf/pdf-to-images');

        const textLayerText = await extractPdfTextLayer(file.buffer);
        if (textLayerText !== null) {
          console.debug('[ReceiptService] PDF mode: PDF_TEXT', file.originalname);
          rawParts.push(textLayerText);
        } else {
          console.debug('[ReceiptService] PDF mode: PDF_SCANNED', file.originalname);
          const pageBuffers = await pdfToImageBuffers(file.buffer);
          for (let i = 0; i < pageBuffers.length; i++) {
            const { rawText } = await this.ocrProvider.extractText(pageBuffers[i]);
            console.debug(
              `[ReceiptService] OCR page ${i + 1} for ${file.originalname}:`,
              rawText.slice(0, 200),
            );
            rawParts.push(`\n\n--- PAGE ${i + 1} ---\n\n${rawText}`);
          }
        }
      } else {
        const { rawText } = await this.ocrProvider.extractText(file.buffer);
        console.debug(
          `[ReceiptService] OCR image for ${file.originalname}:`,
          rawText.slice(0, 200),
        );
        rawParts.push(rawText);
      }
    }

    const rawText = rawParts.join('\n');
    console.debug('[ReceiptService] rawText (first 500 chars):', rawText.slice(0, 500));
    console.debug('[ReceiptService] price extraction enabled:', ENABLE_PRICE_EXTRACTION);

    const parsedItems: ReceiptItemInput[] = postProcessItems(parseItems(rawText), rawText);

    const receipt = await this.receiptRepo.createReceipt({
      userId,
      rawText,
      items: parsedItems,
    });

    return {
      receiptId: receipt.id,
      items: receipt.items,
    };
  }
}
