/**
 * Parses PromoFull XML files from Israeli supermarket chains.
 *
 * Supported schemas:
 *
 * A) Machsanei Hashuk  — Promos > Sales > Sale
 *    Each Sale row has ONE ItemCode. Rows are grouped by PromotionID.
 *
 * B) Rami Levy         — Root > Promotions > Promotion
 *    Items under PromotionItems > Item[].
 *
 * C) Shufersal         — root > Promotions > Promotion   (lowercase root)
 *    Same sub-structure as Rami Levy.
 *
 * Decompression (ZIP / gzip) is handled by the same unwrapToXml used in
 * price-file.parser.ts — imported to avoid duplication.
 */
import { gunzipSync } from 'zlib';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * A single normalized promotion extracted from the XML.
 * Date/time fields are left as raw strings here; the service combines them into
 * Date objects so the parser stays a pure extraction layer.
 */
export interface ParsedPromo {
  promotionId: string;
  description: string;
  startDate?: string;
  startHour?: string;
  endDate?: string;
  endHour?: string;
  rewardType?: number;
  discountType?: number;
  minQty?: number;
  maxQty?: number;
  discountedPrice?: number;
  discountedPricePerMida?: number;
  discountRate?: number;
  allowMultipleDiscounts?: boolean;
  clubId?: string;
  isGift?: boolean;
  isCoupon?: boolean;
  isTotal?: boolean;
  /** false only when the XML explicitly marks it inactive (MH: PromotionIsActive=0) */
  isActive?: boolean;
  itemCodes: string[];
}

/** Top-level result returned by parsePromoXml. */
export interface ParsedPromoFile {
  /** storeId extracted from the XML root, or from the filename as fallback. */
  storeId: string;
  /** Raw chainId string from the XML (may not match our ChainId enum exactly). */
  chainId: string;
  promotions: ParsedPromo[];
}

// ─── Internal XML shapes ──────────────────────────────────────────────────────

// Rami Levy / Shufersal Promotion node
interface RawPromotion {
  PromotionId?: number | string;
  PromotionDescription?: string;
  PromotionStartDate?: string;
  PromotionStartHour?: string;
  PromotionEndDate?: string;
  PromotionEndHour?: string;
  RewardType?: number | string;
  DiscountType?: number | string;
  MinQty?: number | string;
  MaxQty?: number | string;
  DiscountedPrice?: number | string;
  DiscountRate?: number | string;
  AllowMultipleDiscounts?: number | string;
  ClubId?: number | string;
  IsGift?: number | string;
  IsCoupon?: number | string;
  IsTotal?: number | string;
  PromotionItems?: { Item?: RawPromoItem | RawPromoItem[] };
}

interface RawPromoItem {
  ItemCode?: number | string;
}

// Machsanei Hashuk Sale row (one row per ItemCode)
interface RawSale {
  PromotionID?: number | string;
  PromotionDescription?: string;
  PromotionStartDate?: string;
  PromotionStartHour?: string;
  PromotionEndDate?: string;
  PromotionEndHour?: string;
  MinQty?: number | string;
  MaxQty?: number | string;
  DiscountedPrice?: number | string;
  DiscountedPricePerMida?: number | string;
  DiscountRate?: number | string;
  AllowMultipleDiscounts?: number | string;
  PromotionIsActive?: number | string;
  ItemCode?: number | string;
}

interface ParsedXmlPromo {
  // Rami Levy
  Root?: {
    ChainId?: number | string;
    StoreId?: number | string;
    Promotions?: { Promotion?: RawPromotion | RawPromotion[] };
  };
  // Shufersal (lowercase root)
  root?: {
    ChainId?: number | string;
    StoreId?: number | string;
    Promotions?: { Promotion?: RawPromotion | RawPromotion[] };
  };
  // Machsanei Hashuk
  Promos?: {
    ChainID?: number | string;
    StoreID?: number | string;
    Sales?: { Sale?: RawSale | RawSale[] };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeTrimP(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value).trim() || undefined;
}

function toNum(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return Number(value) === 1;
}

/** Extract storeId from filename: second dash-segment, leading zeros stripped. */
function storeIdFromFilename(filename: string): string {
  const namePart = filename.replace(/\.xml(\.gz)?$/i, '');
  const seg = namePart.split('-')[1] ?? '';
  return seg.replace(/^0+/, '') || seg;
}

// ─── Archive unwrapping (mirrors price-file.parser.ts) ────────────────────────

type BufFmt = 'zip' | 'gzip' | 'xml' | 'unknown';

function detectFmt(buf: Buffer): BufFmt {
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04)
    return 'zip';
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) return 'gzip';
  const start = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  if (buf[start] === 0x3c) return 'xml';
  return 'unknown';
}

function unwrapToXml(buf: Buffer, depth = 0): Buffer {
  const MAX_DEPTH = 3;
  const fmt = detectFmt(buf);
  if (fmt === 'xml') return buf;
  if (depth >= MAX_DEPTH) throw new Error(`[PROMO_UNWRAP] max depth reached (last format: ${fmt})`);
  if (fmt === 'gzip') return unwrapToXml(gunzipSync(buf), depth + 1);
  if (fmt === 'zip') {
    const zip = new AdmZip(buf);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    if (!entries[0]) throw new Error('[PROMO_UNWRAP] ZIP archive contains no files');
    return unwrapToXml(entries[0].getData(), depth + 1);
  }
  throw new Error(`[PROMO_UNWRAP] unrecognised format at depth=${depth}`);
}

// ─── XML parser ───────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (tag) => tag === 'Promotion' || tag === 'Item' || tag === 'Sale',
});

// ─── Chain-specific normalizers ───────────────────────────────────────────────

function normalizeRamiLevyShufersal(rawPromos: RawPromotion[]): ParsedPromo[] {
  const results: ParsedPromo[] = [];

  for (const p of rawPromos) {
    const promotionId = safeTrimP(p.PromotionId);
    if (!promotionId) continue;

    const description = safeTrimP(p.PromotionDescription) ?? '';

    // Collect itemCodes from PromotionItems.Item[]
    const rawItems = p.PromotionItems?.Item;
    const items: RawPromoItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    const itemCodes = items
      .map((i) => safeTrimP(i.ItemCode))
      .filter((c): c is string => c !== undefined);

    results.push({
      promotionId,
      description,
      startDate: safeTrimP(p.PromotionStartDate),
      startHour: safeTrimP(p.PromotionStartHour),
      endDate: safeTrimP(p.PromotionEndDate),
      endHour: safeTrimP(p.PromotionEndHour),
      rewardType: toNum(p.RewardType),
      discountType: toNum(p.DiscountType),
      minQty: toNum(p.MinQty),
      maxQty: toNum(p.MaxQty),
      discountedPrice: toNum(p.DiscountedPrice),
      discountRate: toNum(p.DiscountRate),
      allowMultipleDiscounts: toBool(p.AllowMultipleDiscounts),
      clubId: safeTrimP(p.ClubId),
      isGift: toBool(p.IsGift),
      isCoupon: toBool(p.IsCoupon),
      isTotal: toBool(p.IsTotal),
      itemCodes,
    });
  }

  return results;
}

/**
 * Machsanei Hashuk: each Sale row has ONE ItemCode.
 * Group by PromotionID and merge itemCodes into one record.
 */
function normalizeMachsaneiHashuk(rawSales: RawSale[]): ParsedPromo[] {
  const map = new Map<string, ParsedPromo>();

  for (const sale of rawSales) {
    const promotionId = safeTrimP(sale.PromotionID);
    if (!promotionId) continue;

    const itemCode = safeTrimP(sale.ItemCode);

    if (!map.has(promotionId)) {
      const isActiveVal = sale.PromotionIsActive;
      map.set(promotionId, {
        promotionId,
        description: safeTrimP(sale.PromotionDescription) ?? '',
        startDate: safeTrimP(sale.PromotionStartDate),
        startHour: safeTrimP(sale.PromotionStartHour),
        endDate: safeTrimP(sale.PromotionEndDate),
        endHour: safeTrimP(sale.PromotionEndHour),
        minQty: toNum(sale.MinQty),
        maxQty: toNum(sale.MaxQty),
        discountedPrice: toNum(sale.DiscountedPrice),
        discountedPricePerMida: toNum(sale.DiscountedPricePerMida),
        discountRate: toNum(sale.DiscountRate),
        allowMultipleDiscounts: toBool(sale.AllowMultipleDiscounts),
        isActive: isActiveVal !== undefined ? Number(isActiveVal) !== 0 : undefined,
        itemCodes: [],
      });
    }

    if (itemCode) {
      map.get(promotionId)!.itemCodes.push(itemCode);
    }
  }

  return [...map.values()];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a PromoFull XML file and return normalized promotions.
 * Automatically decompresses ZIP/gzip layers by magic bytes.
 * Detects chain schema from the root XML element.
 */
export function parsePromoXml(xmlData: Buffer | string, filename = ''): ParsedPromoFile {
  console.log(`[PROMO_PARSE] start — filename=${filename || '(none)'}`);

  const xmlBuf = Buffer.isBuffer(xmlData) ? unwrapToXml(xmlData) : Buffer.from(xmlData, 'utf-8');
  const xmlString = xmlBuf.toString('utf-8');

  let parsed: ParsedXmlPromo;
  try {
    parsed = xmlParser.parse(xmlString) as ParsedXmlPromo;
  } catch (err) {
    console.error('[PROMO_PARSE] XML parsing failed:', err instanceof Error ? err.message : err);
    console.error('[PROMO_PARSE] first 300 chars:', JSON.stringify(xmlString.slice(0, 300)));
    throw err;
  }

  console.log('[PROMO_PARSE] top-level keys:', Object.keys(parsed).join(', ') || '(none)');

  // ── Machsanei Hashuk: Promos > Sales > Sale ──────────────────────────────
  if (parsed.Promos) {
    const root = parsed.Promos;
    const storeIdXml = safeTrimP(root.StoreID) ?? storeIdFromFilename(filename);
    const chainIdXml = safeTrimP(root.ChainID) ?? '';

    const rawSales = root.Sales?.Sale;
    const sales: RawSale[] = Array.isArray(rawSales) ? rawSales : rawSales ? [rawSales] : [];
    console.log(`[PROMO_PARSE] schema=Promos>Sales>Sale rawSaleCount=${sales.length}`);

    const promotions = normalizeMachsaneiHashuk(sales);
    console.log(
      `[PROMO_PARSE] MachsaneiHashuk — rawSales=${sales.length} groupedPromotions=${promotions.length}`,
    );
    if (promotions.length > 0) {
      console.log('[PROMO_PARSE] sample[0]:', JSON.stringify(promotions[0]));
    }

    return { storeId: storeIdXml, chainId: chainIdXml, promotions };
  }

  // ── Rami Levy / Shufersal: Root/root > Promotions > Promotion ────────────
  const rootNode = parsed.Root ?? parsed.root;
  if (rootNode) {
    const schema = parsed.Root ? 'Root' : 'root';
    const storeIdXml = safeTrimP(rootNode.StoreId) ?? storeIdFromFilename(filename);
    const chainIdXml = safeTrimP(rootNode.ChainId) ?? '';

    const rawPromos = rootNode.Promotions?.Promotion;
    const promos: RawPromotion[] = Array.isArray(rawPromos)
      ? rawPromos
      : rawPromos
        ? [rawPromos]
        : [];
    console.log(`[PROMO_PARSE] schema=${schema}>Promotions>Promotion rawCount=${promos.length}`);

    const promotions = normalizeRamiLevyShufersal(promos);
    console.log(`[PROMO_PARSE] normalized promotions=${promotions.length}`);
    if (promotions.length > 0) {
      console.log('[PROMO_PARSE] sample[0]:', JSON.stringify(promotions[0]));
    }

    return { storeId: storeIdXml, chainId: chainIdXml, promotions };
  }

  // Unknown schema
  console.warn('[PROMO_PARSE] unrecognised schema — no known root element found');
  console.warn('[PROMO_PARSE] first 300 chars:', JSON.stringify(xmlString.slice(0, 300)));
  return { storeId: storeIdFromFilename(filename), chainId: '', promotions: [] };
}
