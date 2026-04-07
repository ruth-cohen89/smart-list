import { gunzipSync } from 'zlib';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

export interface ParsedPromotionItem {
  itemCode: string;
  itemType?: number;
  isGiftItem?: boolean;
}

export interface ParsedPromotionRecord {
  promotionId: string;
  description: string;
  promotionUpdateDate?: string;
  startDate?: string;
  startHour?: string;
  endDate?: string;
  endHour?: string;
  rewardType?: number;
  discountType?: number;
  discountRate?: number;
  minQty?: number;
  maxQty?: number;
  discountedPrice?: number;
  minItemsOffered?: number;
  items: ParsedPromotionItem[];
  rawPayload: Record<string, unknown>;
  discountedPricePerMida?: number;
  allowMultipleDiscounts?: boolean;
  minPurchaseAmount?: number;
  isWeightedPromo?: boolean;
  clubId?: string;
  remarks?: string;
  isGift?: boolean;
  isCoupon?: boolean;
  isTotal?: boolean;
}

export interface ParsedPromotionFile {
  storeId: string;
  promotions: ParsedPromotionRecord[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (tagName) => tagName === 'Promotion' || tagName === 'Item' || tagName === 'Sale',
});

type BufferFormat = 'zip' | 'gzip' | 'xml' | 'unknown';

function detectFormat(buffer: Buffer): BufferFormat {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'zip';
  }

  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return 'gzip';
  }

  const startIndex =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? 3 : 0;

  if (buffer[startIndex] === 0x3c) {
    return 'xml';
  }

  return 'unknown';
}

function unwrapPromotionBuffer(buffer: Buffer, depth = 0): Buffer {
  const format = detectFormat(buffer);

  if (format === 'xml') {
    return buffer;
  }

  if (depth >= 3) {
    throw new Error(`[PROMO_PARSE] archive depth exceeded while extracting promotion XML (${format})`);
  }

  if (format === 'gzip') {
    return unwrapPromotionBuffer(gunzipSync(buffer), depth + 1);
  }

  if (format === 'zip') {
    const archive = new AdmZip(buffer);
    const entry = archive.getEntries().find((candidate) => !candidate.isDirectory);
    if (!entry) {
      throw new Error('[PROMO_PARSE] ZIP archive contained no promotion XML entries');
    }
    return unwrapPromotionBuffer(entry.getData(), depth + 1);
  }

  throw new Error('[PROMO_PARSE] unsupported promotion archive format');
}

export function extractPromotionXml(xmlData: Buffer | string): string {
  if (typeof xmlData === 'string') {
    return xmlData;
  }

  return unwrapPromotionBuffer(xmlData).toString('utf-8');
}

export function parsePromotionXmlDocument<T>(xmlData: Buffer | string): T {
  return xmlParser.parse(extractPromotionXml(xmlData)) as T;
}

export function coerceString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
}

export function coerceNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = Number(value);
  return Number.isNaN(normalized) ? undefined : normalized;
}

export function coerceBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Number(value) === 1;
}

export function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value];
}

export function extractStoreIdFromFilename(filename: string): string {
  const namePart = filename.replace(/\.xml(\.gz)?$/i, '');
  const segments = namePart.split('-');
  const storeId = segments[1] ?? '';
  return storeId.replace(/^0+/, '') || storeId;
}
