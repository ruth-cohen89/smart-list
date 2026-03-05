import { normalizeName } from '../utils/normalize';
import type { OcrProvider } from '../types/ocr-provider';
import type { ReceiptRepository } from '../repositories/receipt.repository';
import type { ReceiptItem } from '../models/receipt.model';

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
  'מעמ', // מע"מ without punctuation
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

// Table header signals for PHOTO/HYBRID receipts (prevents header/address lines becoming items)
const ITEM_TABLE_HEADER_RE = /(תיאור|מחיר|כמות|קוד\s*פריט|קוד\s*מוצר|ברקוד|סה"כ|סה״כ|לתשלום|לתשלם)/;

// Strip punctuation characters that OCR renders inconsistently (geresh, gershayim, quotes).
// Used to compare lines against stopwords/meta robustly.
function normalizeForStopword(s: string): string {
  return s
    .replace(BIDI_RE, '')
    .replace(/[\u05F4\u05F3\u0022\u0027\u201C\u201D\u2018\u2019״׳"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const _normalizedStopwords = STOPWORDS.map(normalizeForStopword);

function hasStopword(line: string): boolean {
  const norm = normalizeForStopword(line);
  return _normalizedStopwords.some((w) => norm.includes(w));
}

// Signals the start of the totals / payment section — stop collecting here.
const TOTALS_SECTION_RE = /(סה"כ|סה״כ|סהכ|סהייכ|סהיכ|לתשלום|לתשלם|subtotal|total\b|עודף|change\b)/i;

function isTotalsSection(line: string): boolean {
  return TOTALS_SECTION_RE.test(line) || TOTALS_SECTION_RE.test(normalizeForStopword(line));
}

// --- Meta lines (store/transaction header/footer) ---
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Detects a "pure" discount line: just a negative amount, no product name.
 * Anchored (^...$) so mid-sentence negatives in product names are never matched.
 * Lines with Hebrew labels like "הנחה -2.00" are caught earlier by hasStopword
 * and never reach this function — that is intentional (totals discounts must
 * not be applied to items).
 */
function extractDiscountAmount(line: string): number | null {
  // Leading minus: -2.00, ₪ -2.00, -2,00
  const leading = line.match(/^₪?\s*-\s*(\d+[.,]\d{1,2})\s*$/);
  if (leading) return -parseFloat(leading[1].replace(',', '.'));
  // Trailing minus: "2.00-", "2,00-", or prefixed "*ק/... 2.00-".
  // Anchored at end of line only — any legitimate discount line ends with amount-.
  // Require exactly 2 decimal digits to avoid false-positives on "1.2" fractions.
  const trailing = line.match(/(\d+[.,]\d{2})\s*-\s*$/);
  if (trailing) return -parseFloat(trailing[1].replace(',', '.'));
  return null;
}

type MulResult =
  | { kind: 'weight'; unitPrice: number; weightKg: number; finalPrice: number }
  | { kind: 'qty'; qty: number; unitPrice: number; finalPrice: number };

/**
 * Detects A × B or A * B multiplication lines and classifies them:
 *   — integer × decimal → quantity × unit price (qty purchase)
 *   — decimal × small decimal (≤ 5 kg) → unit price × weight (weight-sold item)
 *
 * Returns null for plain price lines, lines with no operator, or ambiguous patterns.
 * Does NOT match `x`/`X` (lowercase Latin) to avoid confusing qty-indicator "x2"
 * patterns with arithmetic multiplication.
 */
function extractMultiplyLine(line: string): MulResult | null {
  const m = line.match(/(\d+(?:[.,]\d+)?)\s*[*×]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const a = parseFloat(m[1].replace(',', '.'));
  const b = parseFloat(m[2].replace(',', '.'));

  // Integer × decimal → quantity purchase (e.g. 2 × 3.90 = 7.80)
  const aIsInt = Number.isInteger(a) && a >= 1 && a <= 20;
  const bIsInt = Number.isInteger(b) && b >= 1 && b <= 20;
  if (aIsInt && !bIsInt) return { kind: 'qty', qty: a, unitPrice: b, finalPrice: round2(a * b) };
  if (bIsInt && !aIsInt) return { kind: 'qty', qty: b, unitPrice: a, finalPrice: round2(a * b) };

  // Both decimals → weight purchase (smaller factor is the weight in kg)
  const [unitPrice, weightKg] = a > b ? [a, b] : [b, a];
  if (weightKg > 5 || weightKg < 0.01) return null; // implausible weight
  if (unitPrice < 0.5) return null; // implausible unit price
  return { kind: 'weight', unitPrice, weightKg, finalPrice: round2(unitPrice * weightKg) };
}

/**
 * Returns true for lines that represent a promotion or discount adjustment,
 * not a product name. Used by parseItemsDigital to exclude these from blocks.
 */
function isPromoLine(line: string): boolean {
  if (/מבצע|הנחת|זיכוי/.test(line)) return true;
  if (/(\d+[.,]\d{2})\s*-\s*$/.test(line)) return true;
  if (/₪\s*-\d/.test(line)) return true;
  return false;
}

/**
 * Returns an explicit quantity (1..20) when the segment contains a standalone
 * integer line that is directly adjacent to a ליח / יח label line.
 * Rami Levi digital receipts print quantity and unit on separate lines:
 *   "2\nליח'" or "ליח'\n2".
 */
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

/**
 * Block-based parser for DIGITAL receipts (Rami Levi, Shufersal app, etc.).
 *
 * IMPORTANT CHANGE:
 * - When prices are disabled, we still emit product names (anchored by barcode)
 *   with quantity if available, and price undefined.
 */
function parseItemsDigital(rawText: string): ReceiptItem[] {
  // Normalize double-₪ OCR artifact: "₪₪7.80" → "₪7.80"
  const text = rawText.replace(/₪₪/g, '₪');
  const lines = text.split('\n').map(normalizeLine).filter(Boolean);

  const items: ReceiptItem[] = [];

  // When prices are enabled we dedupe on (normalizedName + finalPrice).
  // When prices are disabled we dedupe on (normalizedName + segmentIndex) to avoid killing repeats.
  const seenKeys = new Set<string>();

  // ── Price pool (used only if prices enabled) ───────────────────────────────
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
      if (isTotalsSection(bl)) break;
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
  // ───────────────────────────────────────────────────────────────────────────

  let lastBarcodeIdx = -1;
  let segmentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (isTotalsSection(raw)) break;

    // Anchor: each barcode marks the end of one item block.
    if (!BARCODE_ONLY_RE.test(raw)) continue;

    // Segment = lines strictly between the previous barcode and this barcode.
    const prevBarcodeIdx = lastBarcodeIdx;
    lastBarcodeIdx = i;

    const segment = lines.slice(prevBarcodeIdx + 1, i);
    if (segment.length === 0) continue;

    // productName: nearest (last) qualifying Hebrew line in segment.
    let productName: string | undefined;
    for (let k = segment.length - 1; k >= 0; k--) {
      const bl = segment[k];
      if (BARCODE_ONLY_RE.test(bl)) continue;
      if (STARS_RE.test(bl) || DATE_RE.test(bl)) continue;
      if (hasStopword(bl)) continue;
      if (isMetaLine(bl)) continue;
      if (isPromoLine(bl)) continue;
      if (!HAS_HEBREW_RE.test(bl)) continue;
      const cleaned = cleanName(bl);
      if (looksLikeRealName(cleaned)) {
        productName = cleaned;
        break;
      }
    }
    if (!productName) continue;

    const normalized = normalizeName(productName);
    if (!normalized) continue;

    // Quantity: explicit standalone integer (1..20) adjacent to a ליח/יח label.
    const explicitQty = extractStandaloneQty(segment);
    let qty: number | undefined = explicitQty;

    // If prices are disabled, we STOP here (names-first).
    if (!ENABLE_PRICE_EXTRACTION) {
      const key = `${normalized}|seg:${segmentIndex++}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      items.push({
        name: productName,
        normalizedName: normalized,
        quantity: qty,
      });
      continue;
    }

    // ── Price extraction (only when enabled) ─────────────────────────────────
    // totalPrice: MAX positive ₪-prefixed amount in segment ONLY (no backfill).
    let totalPrice: number | undefined;
    for (const bl of segment) {
      const m = bl.match(/^₪(\d+(?:[.,]\d{1,2})?)/);
      if (!m) continue;
      const p = parseFloat(m[1].replace(',', '.'));
      if (p > 0 && (totalPrice === undefined || p > totalPrice)) totalPrice = p;
    }

    // unitPrice: first no-letters, no-₪-prefix, non-promo decimal in segment.
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

    // Pool backfill: only when BOTH totalPrice and unitPrice are absent.
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

    // Final price: ₪-total if present; otherwise unitPrice × qty (or just unitPrice).
    let finalPrice: number | undefined;
    if (totalPrice !== undefined) {
      finalPrice = totalPrice;
      if (priceSource === 'none') priceSource = 'segment_total';
    } else if (unitPrice !== undefined) {
      finalPrice = explicitQty !== undefined ? round2(unitPrice * explicitQty) : unitPrice;
      if (priceSource === 'none')
        priceSource = explicitQty !== undefined ? 'segment_unit_x_qty' : 'segment_unit';
    }

    if (!finalPrice || finalPrice <= 0) continue;

    // Quantity inference via ratio (when no explicit qty)
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

  return items;
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
 * -1) leading ₪ anchored at start of line — highest priority (digital receipts)
 * 0) number followed by ₪ (e.g., "12.90₪", "12.9₪")
 * 1) explicit "₪ <number>" (integer or decimal)
 * 2) decimals with dot/comma: 10.80 / 23,90 / 10.8 / 23,9
 * 3) space-decimal ONLY if the line also has ₪ (prevents "90 90" noise)
 */
function extractPrice(line: string): { price: number | null; lineWithoutPrice: string } {
  // If prices are disabled, we still need lineWithoutPrice for cleanName.
  // Return price=null but keep robust "strip" behavior by falling through.
  if (!ENABLE_PRICE_EXTRACTION) {
    return { price: null, lineWithoutPrice: line };
  }

  // -1) ₪ anchored at the very start of the line.
  const leadingShekels = line.match(/^₪\s*(-?\d{1,4}(?:[.,]\d{1,2})?)/);
  if (leadingShekels) {
    const price = parseFloat(leadingShekels[1].replace(',', '.'));
    const lineWithoutPrice = line.slice(leadingShekels[0].length).replace(/\s+/g, ' ').trim();
    return { price, lineWithoutPrice };
  }

  // 0) number followed by ₪
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
      .replace(/\b[a-zA-Z]{1,4}\b/g, ' ')
      .replace(/\b(?:NW|DUI|DON|NIN|OG|WN|WIRD)\b/gi, ' ')
      .replace(/ט"?כ/g, ' ')
      .replace(/[^0-9\u05D0-\u05EA\s]/g, ' ')
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
  if (name.length < 4) return false;
  if (!HAS_LETTERS_RE.test(name)) return false;
  if (!isValidProductName(name)) return false;
  if (isMetaLine(name)) return false;
  if (hasStopword(name)) return false;
  const hebrewLetters = name.replace(/[^\u05D0-\u05EA]/g, '');
  if (HAS_HEBREW_RE.test(name) && hebrewLetters.length < 2) return false;
  const lettersOnly = name.replace(/[^a-zA-Z\u05D0-\u05EA]/g, '');
  if (lettersOnly.length < 2) return false;
  if (name.length > 60) return false;
  return true;
}

/**
 * PHOTO/HYBRID parser:
 * - If prices enabled: original behavior (buffer + close on price)
 * - If prices disabled: names-only inside items zone
 *
 * Key fix:
 * - Items zone opens also when we see a table header (כמות/מחיר/תיאור/קוד פריט)
 *   so we don't parse store/address/header lines as products.
 */
function parseItemsPrimary(rawText: string): ReceiptItem[] {
  const lines = rawText.split('\n').map(normalizeLine);

  const items: ReceiptItem[] = [];
  let nameBuffer = '';
  let startedItems = false;

  // B3: repeated header/footer suppression across PDF pages.
  const linesSeenByPage: Map<string, number> = new Map();
  let currentPageLines: Set<string> = new Set();

  const pushItem = (price: number | undefined, lineForQty: string, overrideQty?: number) => {
    const name = cleanName(nameBuffer);
    if (!looksLikeRealName(name)) return;

    const normalized = normalizeName(name);
    if (!normalized) return;

    items.push({
      name,
      normalizedName: normalized,
      quantity: overrideQty !== undefined ? overrideQty : extractQuantity(lineForQty),
      ...(price !== undefined ? { price } : {}),
    });

    nameBuffer = '';
  };

  // names-only push (no buffering, no price)
  const pushNameOnly = (line: string) => {
    const cleaned = cleanName(line);
    if (!looksLikeRealName(cleaned)) return;
    const normalized = normalizeName(cleaned);
    if (!normalized) return;

    // quantity signals (rare in photo): "x2" or similar
    const qty = extractQuantity(line);

    items.push({
      name: cleaned,
      normalizedName: normalized,
      quantity: qty,
    });
  };

  for (const raw of lines) {
    if (!raw) continue;

    if (/^---\s*PAGE\s+\d+\s*---$/.test(raw)) {
      for (const prev of currentPageLines) {
        linesSeenByPage.set(prev, (linesSeenByPage.get(prev) ?? 0) + 1);
      }
      currentPageLines = new Set();
      nameBuffer = '';
      startedItems = false;
      continue;
    }

    if (raw.length > 120) continue;

    if (BARCODE_ONLY_RE.test(raw)) continue;
    if (STARS_RE.test(raw) || DATE_RE.test(raw) || ZERO_PRICE_LINE_RE.test(raw)) continue;

    if (isTotalsSection(raw)) break;

    const normRaw = normalizeForStopword(raw);
    currentPageLines.add(normRaw);
    if ((linesSeenByPage.get(normRaw) ?? 0) >= 1 && (isMetaLine(raw) || hasStopword(raw))) {
      continue;
    }

    // Items zone can open by header row
    if (!startedItems && ITEM_TABLE_HEADER_RE.test(normRaw)) {
      startedItems = true;
      nameBuffer = '';
      continue;
    }

    if (hasStopword(raw)) continue;
    if (isMetaLine(raw)) continue;

    const line = stripBarcodes(raw);
    if (!line) continue;

    // If prices disabled: names-first extraction inside items zone only
    if (!ENABLE_PRICE_EXTRACTION) {
      if (!startedItems) continue;

      // ignore pure numeric lines / discounts / promotions
      if (!HAS_LETTERS_RE.test(line)) continue;
      if (digitRatio(line) > 0.65) continue;
      if (isDiscountLine(line)) continue;

      pushNameOnly(line);
      continue;
    }

    // ── Original price-based path (kept) ─────────────────────────────────────
    const { price } = extractPrice(line);

    const prevStartedItems = startedItems;

    // once we see a real positive price, we are in items zone
    if (price !== null && Number.isFinite(price) && price > 0) {
      startedItems = true;
    }
    if (!startedItems && /\b\d{1,4}[.,]\d{1,2}\b/.test(line)) {
      startedItems = true;
    }

    if (!startedItems) {
      if (price === null && HAS_LETTERS_RE.test(line) && !isMetaLine(line)) {
        const preSeed = cleanName(line);
        if (looksLikeRealName(preSeed)) {
          nameBuffer = preSeed;
        }
      }
      continue;
    }

    if (!prevStartedItems && HAS_LETTERS_RE.test(line)) {
      nameBuffer = '';
    }

    const discount = extractDiscountAmount(line);
    if (discount !== null) {
      if (items.length > 0 && items[items.length - 1].price !== undefined) {
        items[items.length - 1].price = Math.max(
          0,
          round2((items[items.length - 1].price ?? 0) + discount),
        );
      }
      continue;
    }

    if (ITEM_START_RE.test(line) && nameBuffer) {
      nameBuffer = cleanName(line);
    } else if (HAS_LETTERS_RE.test(line) && !isMetaLine(line)) {
      const cleaned = cleanName(line);
      if (looksLikeRealName(cleaned)) {
        nameBuffer = (nameBuffer ? `${nameBuffer} ${cleaned}` : cleaned).trim();
      }
    }

    if (price !== null && Number.isFinite(price) && price > 0) {
      if (!nameBuffer) continue;
      const mulData = /^₪/.test(line) ? null : extractMultiplyLine(line);
      if (mulData !== null) {
        pushItem(mulData.finalPrice, line, mulData.kind === 'qty' ? mulData.qty : mulData.weightKg);
      } else {
        pushItem(price, line);
      }
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
    if (isTotalsSection(raw)) break;
    if (isMetaLine(raw)) continue;
    if (hasStopword(raw)) continue;

    const line = stripBarcodes(raw);
    if (!line) continue;

    if (isDiscountLine(line)) continue;

    // If prices are disabled, fallback becomes "names-only list"
    if (!ENABLE_PRICE_EXTRACTION) {
      if (HAS_LETTERS_RE.test(line) && digitRatio(line) <= 0.55) {
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
        return { name, normalizedName: normalized } satisfies ReceiptItem;
      })
      .filter((x): x is ReceiptItem => x !== null);
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
  const kind = detectReceiptKind(rawText);

  const hasLeadingShekels = /^₪{1,2}\d/m.test(rawText);

  // DIGITAL: always try digital parser first (it’s anchored by barcodes/format)
  if (kind === 'DIGITAL' || (hasLeadingShekels && kind !== 'PHOTO')) {
    const digital = parseItemsDigital(rawText);
    if (digital.length > 0) return digital;
  }

  const primary = parseItemsPrimary(rawText);
  if (primary.length > 0) return primary;

  return parseItemsFallback(rawText);
}

// ─── Post-processing ──────────────────────────────────────────────────────────

// Strips spaces and punctuation for robust substring matching.
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
  return POST_META_TERMS.some((t) => norm.includes(t));
}

export function detectReceiptKind(rawText: string): 'DIGITAL' | 'PHOTO' | 'HYBRID' {
  let score = 0;

  // DIGITAL signals
  const barcodes = (rawText.match(/\b729\d{9,11}\b/g) ?? []).length;
  if (barcodes >= 3) score += 3;
  else if (barcodes >= 1) score += 1;
  if (/ליח|יח[׳']/.test(rawText)) score += 2;

  // PHOTO signals: multiplication lines (unitPrice * weight or qty × price)
  const mulLines = (rawText.match(/\d+[.,]\d+\s*[*×]\s*\d+[.,]\d+/g) ?? []).length;
  if (mulLines >= 2) score -= 2;
  else if (mulLines >= 1) score -= 1;

  if (score >= 3) return 'DIGITAL';
  if (score <= -2) return 'PHOTO';
  return 'HYBRID';
}

export function postProcessItems(items: ReceiptItem[], rawText: string): ReceiptItem[] {
  const kind = detectReceiptKind(rawText);

  // A) Drop meta / payment / summary items (all receipt types)
  let result = items.filter((item) => !isPostMeta(item.name));

  // B) Drop weak/generic names: Hebrew names need ≥ 3 Hebrew letters;
  //    non-Hebrew names need length ≥ 4.
  result = result.filter((item) => {
    const hebrewLetters = item.name.replace(/[^\u05D0-\u05EA]/g, '');
    if (hebrewLetters.length > 0) return hebrewLetters.length >= 3;
    return item.name.length >= 4;
  });

  // HYBRID → conservative, skip DIGITAL-only rules
  if (kind === 'DIGITAL') {
    // C1) Merge "לק ג" prefix item into the following item
    const merged: ReceiptItem[] = [];
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

    // If prices are enabled, keep your existing deposit/promo filters.
    if (ENABLE_PRICE_EXTRACTION) {
      // C2) Drop deposit lines: "פיקדון" AND price ≤ 1.5
      result = result.filter((item) => !(item.name.includes('פיקדון') && (item.price ?? 0) <= 1.5));

      // C3) Drop promo / discount fragments with small price (≤ 6)
      result = result.filter((item) => {
        const norm = normalizeForPost(item.name);
        const isPromo = ['מבצע', 'הנחת', 'זיכוי'].some((kw) => norm.includes(normalizeForPost(kw)));
        return !(isPromo && (item.price ?? 0) <= 6);
      });
    }
  }

  // D) De-duplicate consecutive items with same normalizedName and price (or name if no price)
  result = result.filter((item, i, arr) => {
    if (i === 0) return true;
    const prev = arr[i - 1];
    if (!ENABLE_PRICE_EXTRACTION) {
      return item.normalizedName !== prev.normalizedName;
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

  async uploadReceipt(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<{ receiptId: string; items: ReceiptItem[] }> {
    const rawParts: string[] = [];

    for (const file of files) {
      const isPdf =
        file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const { extractPdfTextLayer, pdfToImageBuffers } =
          await import('../infrastructure/pdf/pdf-to-images');

        const textLayerText = await extractPdfTextLayer(file.buffer);
        if (textLayerText !== null) {
          console.debug('[ReceiptService] PDF mode: PDF_TEXT (text layer, no OCR)');
          rawParts.push(textLayerText);
        } else {
          console.debug('[ReceiptService] PDF mode: PDF_SCANNED (rendering + OCR)');
          const pageBuffers = await pdfToImageBuffers(file.buffer);
          for (let i = 0; i < pageBuffers.length; i++) {
            const { rawText } = await this.ocrProvider.extractText(pageBuffers[i]);
            rawParts.push(`\n\n--- PAGE ${i + 1} ---\n\n${rawText}`);
          }
        }
      } else {
        const { rawText } = await this.ocrProvider.extractText(file.buffer);
        rawParts.push(rawText);
      }
    }

    const rawText = rawParts.join('\n');
    console.debug('[ReceiptService] rawText (first 500 chars):', rawText.slice(0, 500));
    console.debug('[ReceiptService] price extraction enabled:', ENABLE_PRICE_EXTRACTION);

    const items = postProcessItems(parseItems(rawText), rawText);
    const receipt = await this.receiptRepo.createReceipt({ userId, rawText, items });

    return { receiptId: receipt.id, items: receipt.items };
  }
}
