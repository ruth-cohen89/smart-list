import { URL } from 'url';
import { downloadFile, fetchListingPage, FileEntry, pickLatestFile } from '../chain-source.client';

const BASE_URL = 'https://prices.shufersal.co.il';
const DEFAULT_PRICE_FULL_CATEGORY_ID = 2;
const DEFAULT_PROMO_FULL_CATEGORY_ID = 4;
const DEFAULT_STORE_ID = '413';

export interface ProviderFile {
  filename: string;
  rawData: Buffer;
}

export interface ShufersalProviderOptions {
  categoryId?: number;
  filePrefix?: 'PriceFull' | 'PromoFull';
  storeId?: string;
}

export class ShufersalProvider {
  private readonly categoryId: number;
  private readonly filePrefix: 'PriceFull' | 'PromoFull';
  private readonly storeId: string;

  constructor(options: ShufersalProviderOptions = {}) {
    this.filePrefix = options.filePrefix ?? 'PriceFull';
    this.categoryId =
      options.categoryId ??
      (this.filePrefix === 'PromoFull'
        ? DEFAULT_PROMO_FULL_CATEGORY_ID
        : DEFAULT_PRICE_FULL_CATEGORY_ID);
    this.storeId = options.storeId ?? DEFAULT_STORE_ID;
  }

  async getLatestFile(): Promise<ProviderFile | null> {
    console.log(
      `[IMPORT] ShufersalProvider start chainId=shufersal filePrefix=${this.filePrefix} categoryId=${this.categoryId}`,
    );

    const baseListingUrl =
      `${BASE_URL}/FileObject/UpdateCategory` +
      `?catID=${this.categoryId}&storeId=${this.storeId}&paginate=true`;

    const allEntries = await this.fetchAllPages(baseListingUrl);
    console.log(`[IMPORT] Shufersal total raw links: ${allEntries.length}`);

    if (allEntries.length === 0) {
      console.log(`[IMPORT] no ${this.filePrefix} file found for storeId=${this.storeId}`);
      return null;
    }

    const latest = pickLatestFile(allEntries)!;
    console.log(`[IMPORT] Shufersal selected: ${latest.filename}`);

    const rawData = await downloadFile(latest.downloadUrl);
    console.log(`[IMPORT] downloaded ${latest.filename} (${rawData.length} bytes)`);

    return { filename: latest.filename, rawData };
  }

  private async fetchAllPages(baseListingUrl: string): Promise<FileEntry[]> {
    const page1Url = `${baseListingUrl}&page=1`;
    console.log(`[IMPORT] Shufersal listing page 1: ${page1Url}`);
    const html1 = await fetchListingPage(page1Url);
    const entries1 = this.extractLinks(html1);
    const totalPages = this.detectPageCount(html1);
    console.log(`[IMPORT] Shufersal page 1/${totalPages} — ${entries1.length} links found`);

    const allEntries = [...entries1];
    for (let page = 2; page <= totalPages; page++) {
      const pageUrl = `${baseListingUrl}&page=${page}`;
      console.log(`[IMPORT] Shufersal listing page ${page}: ${pageUrl}`);
      const html = await fetchListingPage(pageUrl);
      const entries = this.extractLinks(html);
      console.log(`[IMPORT] Shufersal page ${page}/${totalPages} — ${entries.length} links found`);
      allEntries.push(...entries);
    }
    return allEntries;
  }

  // Shufersal serves files as Azure Blob .gz URLs (not .xml.gz).
  // The server pre-filters by catID + storeId, so all returned links match the
  // requested prefix and store. We still filter by prefix to guard against any
  // unexpected entries on the page.
  // href="https://...blob.core.windows.net/.../PriceFull...-413-TIMESTAMP.gz?sv=...&amp;..."
  private extractLinks(html: string): FileEntry[] {
    const entries: FileEntry[] = [];
    const linkRe = new RegExp(`href="([^"]*${this.filePrefix}[^"]*[.]gz[^"]*)"`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      const rawHref = m[1].replace(/&amp;/g, '&');
      try {
        const urlObj = new URL(rawHref);
        const filename = urlObj.pathname.split('/').pop();
        if (filename) entries.push({ filename, downloadUrl: rawHref });
      } catch {
        // skip malformed hrefs
      }
    }
    return entries;
  }

  private detectPageCount(html: string): number {
    const pageRe = /[?&]page=(\d+)/gi;
    let max = 1;
    let m: RegExpExecArray | null;
    while ((m = pageRe.exec(html)) !== null) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
    return max;
  }
}
