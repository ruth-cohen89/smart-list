import https from 'https';
import { URL } from 'url';
import { downloadFile } from '../chain-source.client';

const BASE_URL = 'https://prices.shufersal.co.il';
const DEFAULT_PRICE_FULL_CATEGORY_ID = 2;
const DEFAULT_PROMO_FULL_CATEGORY_ID = 4;
const DEFAULT_STORE_ID = '413';

interface FileEntry {
  filename: string;
  downloadUrl: string;
}

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

    const listingUrl =
      `${BASE_URL}/FileObject/UpdateCategory` +
      `?catID=${this.categoryId}&storeId=${this.storeId}&paginate=true&page=1`;

    const { body: html, contentType } = await this.fetchHtml(listingUrl);
    console.log(`[IMPORT] content-type=${contentType}`);

    const entries = this.parseTableRows(html);
    const discovered = entries.filter(
      (entry) =>
        entry.filename.startsWith(this.filePrefix) && entry.filename.includes(`-${this.storeId}-`),
    );

    console.log(
      `[IMPORT] discovered ${this.filePrefix} files for storeId=${this.storeId}: ${discovered.map((entry) => entry.filename).join(', ') || 'none'}`,
    );

    if (discovered.length === 0) {
      console.log(`[IMPORT] no ${this.filePrefix} file found for storeId=${this.storeId}`);
      return null;
    }

    const latest = discovered.reduce((current, candidate) =>
      candidate.filename.localeCompare(current.filename) > 0 ? candidate : current,
    );

    console.log(`[IMPORT] selected latest ${this.filePrefix} file: ${latest.filename}`);

    const rawData = await downloadFile(latest.downloadUrl);
    console.log(
      `[IMPORT] downloaded ${this.filePrefix} file: ${latest.filename} (${rawData.length} bytes)`,
    );

    return { filename: latest.filename, rawData };
  }

  private parseTableRows(html: string): FileEntry[] {
    const entries: FileEntry[] = [];
    const rowRe = /<tr[^>]*class="webgrid-row-style"[^>]*>([\s\S]*?)<\/tr>/gi;
    const hrefRe = /<a\s+[^>]*href="([^"]+)"/i;

    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(html)) !== null) {
      const hrefMatch = hrefRe.exec(rowMatch[1]);
      if (!hrefMatch) continue;

      const downloadUrl = hrefMatch[1].replace(/&amp;/g, '&');
      try {
        const pathname = new URL(downloadUrl).pathname;
        const filename = pathname.split('/').pop();
        if (filename) {
          entries.push({ filename, downloadUrl });
        }
      } catch {
        // Ignore malformed listing entries.
      }
    }

    return entries;
  }

  private fetchHtml(url: string): Promise<{ body: string; contentType: string }> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        const contentType = res.headers['content-type'] ?? 'unknown';
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            body: Buffer.concat(chunks).toString('utf-8'),
            contentType,
          });
        });
        res.on('error', reject);
      });

      req.on('error', reject);
    });
  }
}
