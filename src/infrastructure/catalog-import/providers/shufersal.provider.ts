/**
 * ShufersalProvider — handles all interaction with prices.shufersal.co.il.
 *
 * Responsibilities:
 *  - fetching PriceFull file listings (catID=2) for store 413
 *  - handling pagination
 *  - picking the newest file
 *  - downloading the raw file bytes
 */
import https from 'https';
import { downloadFile } from '../chain-source.client';

const BASE_URL = 'https://prices.shufersal.co.il';
const PRICE_FULL_CAT_ID = 2;
const STORE_ID = '413';

interface ShufersalEntry {
  FileNm: string;
  DownloadLink: string;
}

interface ShufersalPage {
  success: boolean;
  total: number;
  page: number;
  pageSize: number;
  data: ShufersalEntry[];
}

export interface ProviderFile {
  filename: string;
  rawData: Buffer;
}

export class ShufersalProvider {
  async getLatestFile(): Promise<ProviderFile | null> {
    console.log(`[IMPORT] ShufersalProvider start — chainId: shufersal`);
    console.log(`[IMPORT] source: ${BASE_URL}`);

    const allFiles = await this.fetchAllPages();
    console.log(`[IMPORT] files found: ${allFiles.length}`);

    if (allFiles.length === 0) {
      console.log(`[IMPORT] no PriceFull file found for storeId: ${STORE_ID}`);
      return null;
    }

    const latest = allFiles.reduce((a, b) => (b.FileNm.localeCompare(a.FileNm) > 0 ? b : a));
    console.log(`[IMPORT] selected file: ${latest.FileNm}`);

    try {
      const rawData = await downloadFile(latest.DownloadLink);
      console.log(`[IMPORT] download success: ${latest.FileNm} (${rawData.length} bytes)`);
      return { filename: latest.FileNm, rawData };
    } catch (err) {
      console.error(`[IMPORT] download failure: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async fetchAllPages(): Promise<ShufersalEntry[]> {
    const results: ShufersalEntry[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url =
        `${BASE_URL}/FileObject/UpdateCategory` +
        `?catID=${PRICE_FULL_CAT_ID}&storeId=${STORE_ID}&paginate=true&page=${page}`;

      const pageData = await this.fetchPage(url);
      const priceFullEntries = pageData.data.filter((f) => f.FileNm.startsWith('PriceFull'));
      results.push(...priceFullEntries);

      if (pageData.pageSize > 0) {
        totalPages = Math.ceil(pageData.total / pageData.pageSize);
      }
      page++;
    } while (page <= totalPages);

    return results;
  }

  private fetchPage(url: string): Promise<ShufersalPage> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            const raw: unknown = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            // Shufersal wraps the payload in { d: { ... } }
            const payload =
              raw && typeof raw === 'object' && 'd' in raw
                ? (raw as { d: ShufersalPage }).d
                : (raw as ShufersalPage);
            resolve(payload);
          } catch {
            reject(new Error(`Failed to parse Shufersal listing response from: ${url}`));
          }
        });
        res.on('error', reject);
      });
      req.on('error', reject);
    });
  }
}
