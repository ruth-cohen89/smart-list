/**
 * MachsaneiHashukProvider — fetches PriceFull files from the Matrix catalog at laibcatalog.co.il.
 *
 * The Matrix listing page is an HTML table with 8 columns:
 *   [0] filename (no extension)  [1] chain name (Hebrew)  [2] branch/store
 *   [3] type  [4] extension  [5] size  [6] date  [7] download link
 *
 * Filtering is STRICT — all of the following must match:
 *   - chainName (col 1) includes "מחסני השוק"
 *   - filename (from href) starts with "PriceFull" (case-insensitive)
 *   - storeId embedded in filename === "097" (with or without leading zeros)
 *   - chainId embedded in filename is in MACHSANEI_HASHUK_CHAIN_IDS
 *
 * This avoids false positives from other chains that share storeId 97.
 */
import { fetchListingPage, downloadFile } from '../chain-source.client';

const LISTING_URL = 'https://laibcatalog.co.il/';
const TARGET_STORE_ID = '97'; // normalised (leading zeros stripped)
const TARGET_CHAIN_NAME = 'מחסני השוק';
const MACHSANEI_HASHUK_CHAIN_IDS = new Set(['7290661400001', '7290633800006']);

export interface ProviderFile {
  filename: string;
  rawData: Buffer;
}

// ─── Internal row type ────────────────────────────────────────────────────────

interface MatrixRow {
  filename: string;
  chainName: string;
  downloadUrl: string;
  /** chainId extracted from filename (digits between start and first "-") */
  chainId: string;
  /** storeId extracted from filename (second dash-segment, leading zeros stripped) */
  storeId: string;
}

// ─── HTML parser ──────────────────────────────────────────────────────────────

/**
 * Parse the Matrix HTML table into structured rows.
 * Each <tr> with at least 8 <td> elements is treated as a data row.
 * The download href uses backslashes as path separators — these are normalised.
 */
function parseMatrixRows(html: string): MatrixRow[] {
  const rows: MatrixRow[] = [];

  // Match every <tr>...</tr> block (non-greedy, dotall)
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  // Match individual <td>...</td> cells
  const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  // Match the href inside an <a> tag (single or double quotes)
  const hrefRe = /href=['"]([^'"]+)['"]/i;
  // Strip all HTML tags to get plain text
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim();

  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(html)) !== null) {
    const rowHtml = trMatch[1];

    // Collect all <td> cells in this row
    const cells: string[] = [];
    tdRe.lastIndex = 0;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRe.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1]);
    }

    if (cells.length < 8) continue; // header or malformed row

    const chainName = stripTags(cells[1]);

    // Last cell contains the download link
    const hrefMatch = hrefRe.exec(cells[7]);
    if (!hrefMatch) continue;

    // Normalise backslashes → forward slashes and build absolute URL
    const rawHref = hrefMatch[1].replace(/\\/g, '/');
    const downloadUrl = new URL(rawHref, LISTING_URL).href;

    // Filename is the last path segment of the href (includes .xml.gz)
    const filename = rawHref.split('/').pop() ?? '';
    if (!filename) continue;

    // Extract chainId and storeId from filename:
    // Pattern: {prefix}{chainId}-{storeId}-{timestamp}[...].xml.gz
    // e.g.    PriceFull7290661400001-097-202604061700.xml.gz
    const namePart = filename.replace(/\.xml(\.gz)?$/i, '');
    const segments = namePart.split('-');
    // chainId is the digits appended to the prefix word (first segment after stripping alpha prefix)
    const chainIdMatch = /^[A-Za-z]+(\d+)$/.exec(segments[0] ?? '');
    const chainId = chainIdMatch?.[1] ?? '';
    // storeId is the second segment, strip leading zeros for comparison
    const storeId = (segments[1] ?? '').replace(/^0+/, '') || (segments[1] ?? '');

    rows.push({ filename, chainName, downloadUrl, chainId, storeId });
  }

  return rows;
}

// ─── Shared fetch helper ──────────────────────────────────────────────────────

/**
 * Shared logic for fetching the latest Machsanei Hashuk file by prefix.
 * Used by both the price provider (PriceFull) and the promo provider (PromoFull).
 */
async function getLatestMatrixFile(filePrefix: string): Promise<ProviderFile | null> {
  console.log(`[IMPORT] MachsaneiHashuk — source: ${LISTING_URL} prefix: ${filePrefix}`);

  const html = await fetchListingPage(LISTING_URL);
  console.log(`[IMPORT] listing page fetched — length: ${html.length} chars`);

  const allRows = parseMatrixRows(html);
  console.log(`[IMPORT] total table rows parsed: ${allRows.length}`);

  // Step 1: filter by chain name
  const byChain = allRows.filter((r) => r.chainName.includes(TARGET_CHAIN_NAME));
  console.log(`[IMPORT] rows matching chainName "${TARGET_CHAIN_NAME}": ${byChain.length}`);

  // Step 2: strict filter — prefix + storeId + chainId
  const normalizedTargetStore = TARGET_STORE_ID.replace(/^0+/, '') || TARGET_STORE_ID;
  const prefixLower = filePrefix.toLowerCase();
  const candidates = byChain.filter(
    (r) =>
      r.filename.toLowerCase().startsWith(prefixLower) &&
      r.storeId === normalizedTargetStore &&
      MACHSANEI_HASHUK_CHAIN_IDS.has(r.chainId),
  );
  console.log(
    `[IMPORT] ${filePrefix} candidates (storeId=${TARGET_STORE_ID}, chainIds=${[...MACHSANEI_HASHUK_CHAIN_IDS].join('/')}): ${candidates.length}`,
  );
  if (candidates.length > 0) {
    console.log(`[IMPORT] candidate files: ${candidates.map((c) => c.filename).join(', ')}`);
  }

  if (candidates.length === 0) {
    console.log(
      `[IMPORT] no ${filePrefix} file found for chainName="${TARGET_CHAIN_NAME}" storeId=${TARGET_STORE_ID}`,
    );
    return null;
  }

  // Step 3: pick newest by lex sort — timestamp is embedded in filename
  const latest = candidates.reduce((a, b) => (b.filename.localeCompare(a.filename) > 0 ? b : a));
  console.log(`[IMPORT] selected file: ${latest.filename} url: ${latest.downloadUrl}`);

  const rawData = await downloadFile(latest.downloadUrl);
  console.log(`[IMPORT] download success: ${latest.filename} (${rawData.length} bytes)`);

  return { filename: latest.filename, rawData };
}

// ─── Providers ────────────────────────────────────────────────────────────────

export const machsaneiHashukProvider = {
  getLatestFile(): Promise<ProviderFile | null> {
    return getLatestMatrixFile('PriceFull');
  },
};

export const machsaneiHashukPromoProvider = {
  getLatestFile(): Promise<ProviderFile | null> {
    return getLatestMatrixFile('PromoFull');
  },
};
