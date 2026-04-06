/**
 * ShufersalPromoProvider — fetches PromoFull files from prices.shufersal.co.il.
 * catID=3 is the PromoFull category on the Shufersal catalog API.
 * Structure mirrors ShufersalProvider but targets the promotions category.
 */
import https from 'https';
import { URL } from 'url';
import { downloadFile } from '../chain-source.client';

const BASE_URL = 'https://prices.shufersal.co.il';
const PROMO_FULL_CAT_ID = 3;
const STORE_ID = '413';

interface FileEntry {
  filename: string;
  downloadUrl: string;
}

export interface ProviderFile {
  filename: string;
  rawData: Buffer;
}

export class ShufersalPromoProvider {
  async getLatestFile(): Promise<ProviderFile | null> {
    console.log(`[IMPORT] ShufersalPromoProvider start — chainId: shufersal`);

    const listingUrl =
      `${BASE_URL}/FileObject/UpdateCategory` +
      `?catID=${PROMO_FULL_CAT_ID}&storeId=${STORE_ID}&paginate=true&page=1`;

    const { body: html, contentType } = await this.fetchHtml(listingUrl);
    console.log(`[IMPORT] content-type: ${contentType}`);

    const entries = this.parseTableRows(html);
    console.log(`[IMPORT] rows found: ${entries.length}`);

    const filtered = entries.filter(
      (e) => e.filename.startsWith('PromoFull') && e.filename.includes(`-${STORE_ID}-`),
    );
    console.log(`[IMPORT] PromoFull candidates for storeId=${STORE_ID}: ${filtered.length}`);

    if (filtered.length === 0) {
      console.log(`[IMPORT] no PromoFull file found for storeId: ${STORE_ID}`);
      return null;
    }

    const latest = filtered.reduce((a, b) => (b.filename.localeCompare(a.filename) > 0 ? b : a));
    console.log(`[IMPORT] selected file: ${latest.filename}`);

    const rawData = await downloadFile(latest.downloadUrl);
    console.log(`[IMPORT] download success: ${latest.filename} (${rawData.length} bytes)`);

    return { filename: latest.filename, rawData };
  }

  private parseTableRows(html: string): FileEntry[] {
    const entries: FileEntry[] = [];
    const rowRe = /<tr[^>]*class="webgrid-row-style"[^>]*>([\s\S]*?)<\/tr>/gi;
    const hrefRe = /<a\s+[^>]*href="([^"]+)"/i;

    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      const hrefMatch = hrefRe.exec(rowHtml);
      if (!hrefMatch) continue;

      const downloadUrl = hrefMatch[1].replace(/&amp;/g, '&');
      try {
        const pathname = new URL(downloadUrl).pathname;
        const filename = pathname.split('/').pop();
        if (filename) entries.push({ filename, downloadUrl });
      } catch {
        // skip malformed URLs
      }
    }

    return entries;
  }

  private fetchHtml(url: string): Promise<{ body: string; contentType: string }> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        const contentType = res.headers['content-type'] ?? 'unknown';
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ body: Buffer.concat(chunks).toString('utf-8'), contentType }),
        );
        res.on('error', reject);
      });
      req.on('error', reject);
    });
  }
}
