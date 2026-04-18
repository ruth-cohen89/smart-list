/**
 * Parses the government-mandated Israeli supermarket PriceFull XML format.
 *
 * Standard structure (all 3 chains follow this schema):
 *   <Root>
 *     <ChainId>...</ChainId>
 *     <StoreId>...</StoreId>
 *     <Items>
 *       <Item>
 *         <ItemCode>7290000101605</ItemCode>    ← EAN barcode, used as externalId
 *         <ItemName>לחם מלא</ItemName>
 *         <ItemPrice>12.90</ItemPrice>
 *         <Quantity>750</Quantity>              ← package quantity (e.g. grams)
 *         <UnitOfMeasure>גרם</UnitOfMeasure>   ← unit label
 *         <ItemStatus>1</ItemStatus>            ← 1 = active
 *       </Item>
 *     </Items>
 *   </Root>
 */
import { gunzipSync } from 'zlib';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

// ─── Output type ──────────────────────────────────────────────────────────────

export interface ParsedProduct {
  /** Chain's own product identifier — always present, used as externalId. */
  itemCode: string;
  /**
   * Set only when itemCode looks like a real barcode (8–14 digits).
   * Produce / weighted items typically have short internal codes and will NOT have this set.
   */
  barcode?: string;
  itemName: string;
  itemPrice: number;
  quantity?: number;
  unitOfMeasure?: string;
  // ── Extended metadata (preserved for future matching / produce handling) ──
  itemType?: number;
  isWeighted?: boolean;
  manufacturerName?: string;
  manufacturerItemDescription?: string;
  priceUpdateDate?: string;
  qtyInPackage?: number;
  unitQty?: string;
  unitOfMeasurePrice?: number;
}

// ─── Internal XML shape (what fast-xml-parser returns) ───────────────────────

interface RawItem {
  ItemCode?: number | string;
  /** Standard name field (Shufersal, Rami Levy via ItemNm) */
  ItemName?: string;
  /** Rami Levy uses ItemNm instead of ItemName */
  ItemNm?: string;
  ManufacturerName?: string;
  /** Machsanei Hashuk spells it ManufactureName (no 'r') */
  ManufactureName?: string;
  ManufacturerItemDescription?: string;
  /** Machsanei Hashuk spells it ManufactureItemDescription */
  ManufactureItemDescription?: string;
  ItemPrice?: number | string;
  UnitOfMeasurePrice?: number | string;
  Quantity?: number | string;
  QtyInPackage?: number | string;
  UnitOfMeasure?: string;
  /** Machsanei Hashuk uses UnitMeasure (no 'Of') */
  UnitMeasure?: string;
  UnitQty?: string;
  ItemType?: number | string;
  /** 1 = active/for-sale; filter out other statuses */
  ItemStatus?: number | string;
  /** Machsanei Hashuk uses lowercase itemStatus */
  itemStatus?: number | string;
  /** 1 = weighted/sold-by-weight (produce, deli) — Rami Levy */
  bIsWeighted?: number | string;
  /** Machsanei Hashuk uses BisWeighted */
  BisWeighted?: number | string;
  PriceUpdateDate?: string;
  AllowDiscount?: number | string;
}

interface ParsedXml {
  Root?: { Items?: { Item?: RawItem | RawItem[] } };
  // Shufersal (and some other chains) use lowercase <root>
  root?: { Items?: { Item?: RawItem | RawItem[] } };
  // Machsanei Hashuk uses Prices > Products > Product
  Prices?: { Products?: { Product?: RawItem | RawItem[] } };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely convert any XML value (may be number due to parseTagValue) to a trimmed string. */
function safeTrim(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value).trim() || undefined;
}

// ─── Parser singleton (re-used across calls) ─────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: true, // auto-parse "12.90" → 12.90 and "1" → 1
  trimValues: true,
  // Always return item elements as arrays — prevents single-item files returning an object
  isArray: (tagName: string) => tagName === 'Item' || tagName === 'Product',
});

// ─── Archive unwrapping ───────────────────────────────────────────────────────

type BufferFormat = 'zip' | 'gzip' | 'xml' | 'unknown';

function detectFormat(buf: Buffer): BufferFormat {
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04)
    return 'zip';
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) return 'gzip';
  // strip UTF-8 BOM if present before checking for XML
  const start = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? 3 : 0;
  if (buf[start] === 0x3c) return 'xml'; // '<'
  return 'unknown';
}

/**
 * Recursively unwrap ZIP/gzip layers until raw XML bytes are reached.
 * Detection is by magic bytes only — never by filename/extension.
 * Throws if XML is not reached within maxDepth layers.
 */
function unwrapToXml(buf: Buffer, depth = 0): Buffer {
  const MAX_DEPTH = 3;
  const fmt = detectFormat(buf);
  console.log(
    `[UNWRAP] depth=${depth} format=${fmt} size=${buf.length} first4=${Array.from(buf.subarray(0, 4))}`,
  );

  if (fmt === 'xml') {
    console.log(`[UNWRAP] reached XML at depth=${depth}`);
    return buf;
  }

  if (depth >= MAX_DEPTH) {
    throw new Error(
      `[UNWRAP] max depth ${MAX_DEPTH} reached without finding XML (last format: ${fmt})`,
    );
  }

  if (fmt === 'gzip') {
    const inner = gunzipSync(buf);
    console.log(
      `[UNWRAP] gunzip OK — inner size=${inner.length} first4=${Array.from(inner.subarray(0, 4))}`,
    );
    return unwrapToXml(inner, depth + 1);
  }

  if (fmt === 'zip') {
    const zip = new AdmZip(buf);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    console.log(`[UNWRAP] zip entries: ${entries.map((e) => e.entryName).join(', ')}`);
    // Prefer the first non-directory entry (there is typically only one)
    const entry = entries[0];
    if (!entry) throw new Error('[UNWRAP] ZIP archive contains no files');
    console.log(`[UNWRAP] extracting entry: ${entry.entryName}`);
    const inner = entry.getData();
    console.log(
      `[UNWRAP] entry extracted — size=${inner.length} first4=${Array.from(inner.subarray(0, 4))}`,
    );
    return unwrapToXml(inner, depth + 1);
  }

  throw new Error(
    `[UNWRAP] unrecognised format at depth=${depth}, first4=${Array.from(buf.subarray(0, 4))}`,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a PriceFull XML file (as raw Buffer or string) and return the products.
 * Automatically unwraps nested ZIP/gzip containers by magic bytes — not by extension.
 * Skips items with missing name, missing/zero price, or inactive status.
 */
export function parsePriceXml(xmlData: Buffer | string, filename?: string): ParsedProduct[] {
  console.log(`[PARSE] start — filename=${filename ?? '(none)'}`);

  let xmlBuf: Buffer;
  if (Buffer.isBuffer(xmlData)) {
    xmlBuf = unwrapToXml(xmlData);
  } else {
    xmlBuf = Buffer.from(xmlData, 'utf-8');
  }

  const xmlString = xmlBuf.toString('utf-8');

  console.log('[PARSE] xml first 300 chars:', JSON.stringify(xmlString.slice(0, 300)));

  let parsed: ParsedXml;
  try {
    parsed = xmlParser.parse(xmlString) as ParsedXml;
  } catch (err) {
    console.error('[PARSE] XML parsing failed');
    console.error('[PARSE] xml first 300 chars:', JSON.stringify(xmlString.slice(0, 300)));
    throw err;
  }

  // Debug: top-level keys and known root detection
  console.log('[PARSE] top-level keys:', Object.keys(parsed).join(', ') || '(none)');
  console.log(`[PARSE] Root=${!!parsed.Root} root=${!!parsed.root} Prices=${!!parsed.Prices}`);
  console.log(
    `[PARSE] Prices.Products exists=${!!parsed.Prices?.Products} Root.Items exists=${!!(parsed.Root?.Items ?? parsed.root?.Items)}`,
  );

  // Resolve items — support Root/root (Rami Levy, Shufersal) and Prices (Machsanei Hashuk)
  let items: RawItem[];
  if (parsed.Prices?.Products) {
    const raw = parsed.Prices.Products.Product;
    items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    console.log(`[PARSE] schema=Prices>Products>Product productCount=${items.length}`);
  } else {
    const rootNode = parsed.Root ?? parsed.root;
    const raw = rootNode?.Items?.Item;
    items = Array.isArray(raw) ? raw : raw ? [raw] : [];
    console.log(
      `[PARSE] schema=${parsed.Root ? 'Root' : parsed.root ? 'root' : '(none)'}>Items>Item itemCount=${items.length}`,
    );
  }

  const results: ParsedProduct[] = [];
  let skippedStatus = 0;
  let skippedCode   = 0;
  let skippedName   = 0;
  let skippedPrice  = 0;

  if (items.length > 0) {
    const first = items[0];
    console.log('[PARSE] first raw item keys:', Object.keys(first).join(', '));
    console.log('[PARSE] first raw item:', JSON.stringify(first));
    console.log(
      '[PARSE] raw field values —',
      `ItemStatus=${JSON.stringify(first.ItemStatus)}`,
      `itemStatus=${JSON.stringify(first.itemStatus)}`,
      `ItemCode=${JSON.stringify(first.ItemCode)}`,
      `ItemName=${JSON.stringify(first.ItemName)}`,
      `ItemNm=${JSON.stringify(first.ItemNm)}`,
      `ItemPrice=${JSON.stringify(first.ItemPrice)}`,
    );
  }

  for (const item of items) {
    // Skip inactive items — covers ItemStatus (standard), itemStatus (Machsanei Hashuk lowercase)
    const statusVal = item.ItemStatus ?? item.itemStatus;
    if (statusVal !== undefined && Number(statusVal) !== 1) {
      skippedStatus++;
      continue;
    }

    const itemCode = item.ItemCode !== undefined ? String(item.ItemCode).trim() : '';
    // Name fallback chain: ItemName → ItemNm (Rami Levy) → ManufacturerItemDescription / ManufactureItemDescription
    const itemName =
      safeTrim(
        item.ItemName ??
          item.ItemNm ??
          item.ManufacturerItemDescription ??
          item.ManufactureItemDescription,
      ) ?? '';
    const rawPrice = Number(item.ItemPrice);

    if (!itemCode)                  { skippedCode++;  continue; }
    if (!itemName)                  { skippedName++;  continue; }
    if (!rawPrice || rawPrice <= 0) { skippedPrice++; continue; }

    // Barcode only when itemCode looks like a real EAN/UPC (8–14 digits)
    const isLikelyBarcode = /^\d{8,14}$/.test(itemCode);

    const rawQty = item.Quantity !== undefined ? Number(item.Quantity) : NaN;
    // UnitMeasure = Machsanei Hashuk, UnitOfMeasure = standard, UnitQty = fallback
    const unit = safeTrim(item.UnitOfMeasure ?? item.UnitMeasure ?? item.UnitQty);

    const rawUomPrice =
      item.UnitOfMeasurePrice !== undefined ? Number(item.UnitOfMeasurePrice) : NaN;
    const rawQtyInPkg = item.QtyInPackage !== undefined ? Number(item.QtyInPackage) : NaN;
    const rawItemType = item.ItemType !== undefined ? Number(item.ItemType) : NaN;

    results.push({
      itemCode,
      barcode: isLikelyBarcode ? itemCode : undefined,
      itemName,
      itemPrice: rawPrice,
      quantity: !isNaN(rawQty) && rawQty > 0 ? rawQty : undefined,
      unitOfMeasure: unit,
      itemType: !isNaN(rawItemType) ? rawItemType : undefined,
      // bIsWeighted = Rami Levy, BisWeighted = Machsanei Hashuk
      isWeighted:
        item.bIsWeighted !== undefined
          ? Number(item.bIsWeighted) === 1
          : item.BisWeighted !== undefined
            ? Number(item.BisWeighted) === 1
            : undefined,
      // ManufacturerName = standard, ManufactureName = Machsanei Hashuk (no 'r')
      manufacturerName: safeTrim(item.ManufacturerName ?? item.ManufactureName),
      // ManufacturerItemDescription = standard, ManufactureItemDescription = Machsanei Hashuk
      manufacturerItemDescription: safeTrim(
        item.ManufacturerItemDescription ?? item.ManufactureItemDescription,
      ),
      priceUpdateDate: safeTrim(item.PriceUpdateDate),
      qtyInPackage: !isNaN(rawQtyInPkg) && rawQtyInPkg > 0 ? rawQtyInPkg : undefined,
      unitQty: safeTrim(item.UnitQty),
      unitOfMeasurePrice: !isNaN(rawUomPrice) && rawUomPrice > 0 ? rawUomPrice : undefined,
    });
  }

  // ── Debug summary ──────────────────────────────────────────────────────────
  const skippedCount = skippedStatus + skippedCode + skippedName + skippedPrice;
  const barcodeCount = results.filter((p) => p.barcode !== undefined).length;
  const noBarcodeCount = results.length - barcodeCount;
  console.log(
    `[PARSE] done — parsed=${results.length} skipped=${skippedCount}` +
      ` (status=${skippedStatus} code=${skippedCode} name=${skippedName} price=${skippedPrice})` +
      ` withBarcode=${barcodeCount} noBarcode=${noBarcodeCount}`,
  );
  results.slice(0, 3).forEach((p, i) => console.log(`[PARSE] sample[${i}]:`, JSON.stringify(p)));

  return results;
}
