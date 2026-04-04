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
import { XMLParser } from 'fast-xml-parser';

// ─── Output type ──────────────────────────────────────────────────────────────

export interface ParsedProduct {
  /** Chain's item code — doubles as the barcode (EAN-13) in Israeli price files. */
  itemCode: string;
  itemName: string;
  itemPrice: number;
  quantity?: number;
  unitOfMeasure?: string;
}

// ─── Internal XML shape (what fast-xml-parser returns) ───────────────────────

interface RawItem {
  ItemCode?: number | string;
  ItemName?: string;
  ItemPrice?: number | string;
  Quantity?: number | string;
  UnitOfMeasure?: string;
  /** Fallback unit field used by some chains instead of UnitOfMeasure */
  UnitQty?: string;
  /** 1 = active/for-sale; filter out other statuses */
  ItemStatus?: number | string;
}

interface ParsedXml {
  Root?: { Items?: { Item?: RawItem | RawItem[] } };
  // Shufersal (and some other chains) use lowercase <root>
  root?: { Items?: { Item?: RawItem | RawItem[] } };
}

// ─── Parser singleton (re-used across calls) ─────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: true, // auto-parse "12.90" → 12.90 and "1" → 1
  trimValues: true,
  // Always return Item as array — prevents single-item files returning an object
  isArray: (tagName: string) => tagName === 'Item',
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a PriceFull XML file (as Buffer or string) and return the products.
 * Skips items with missing name, missing/zero price, or inactive status.
 */
export function parsePriceXml(xmlData: Buffer | string): ParsedProduct[] {
  const xmlString = Buffer.isBuffer(xmlData) ? xmlData.toString('utf-8') : xmlData;

  const parsed = xmlParser.parse(xmlString) as ParsedXml;

  const rootNode = parsed.Root ?? parsed.root;
  const rawItems = rootNode?.Items?.Item;
  // fast-xml-parser with isArray ensures this is always an array
  const items: RawItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  const results: ParsedProduct[] = [];

  for (const item of items) {
    // Skip inactive items (ItemStatus 0 or missing)
    if (item.ItemStatus !== undefined && Number(item.ItemStatus) !== 1) continue;

    const itemCode = item.ItemCode !== undefined ? String(item.ItemCode).trim() : '';
    const itemName = item.ItemName?.trim() ?? '';
    const rawPrice = Number(item.ItemPrice);

    if (!itemCode || !itemName || !rawPrice || rawPrice <= 0) continue;

    const rawQty = item.Quantity !== undefined ? Number(item.Quantity) : NaN;
    const unit = (item.UnitOfMeasure ?? item.UnitQty)?.trim() || undefined;

    results.push({
      itemCode,
      itemName,
      itemPrice: rawPrice,
      quantity: !isNaN(rawQty) && rawQty > 0 ? rawQty : undefined,
      unitOfMeasure: unit,
    });
  }

  return results;
}
