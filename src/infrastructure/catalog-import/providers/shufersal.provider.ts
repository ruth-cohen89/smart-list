/**
 * ShufersalProvider — handles all interaction with prices.shufersal.co.il.
 *
 * The UpdateCategory endpoint returns an HTML page with a <table> of file rows.
 * Each row's first <a href> is a signed Azure Blob download URL; the filename
 * is the last path segment of that URL (e.g. PriceFull...-413-...202604040340.gz).
 */
import https from 'https';
import { URL } from 'url';
import { downloadFile } from '../chain-source.client';

const BASE_URL = 'https://prices.shufersal.co.il';
const PRICE_FULL_CAT_ID = 2;
const STORE_ID = '413';

interface FileEntry {
  filename: string;
  downloadUrl: string;
}

export interface ProviderFile {
  filename: string;
  rawData: Buffer;
}

export class ShufersalProvider {
  async getLatestFile(): Promise<ProviderFile | null> {
    console.log(`[IMPORT] ShufersalProvider start — chainId: shufersal`);
    console.log(`[IMPORT] source: ${BASE_URL}`);

    const listingUrl =
      `${BASE_URL}/FileObject/UpdateCategory` +
      `?catID=${PRICE_FULL_CAT_ID}&storeId=${STORE_ID}&paginate=true&page=1`;

    const { body: html, contentType } = await this.fetchHtml(listingUrl);

    console.log(`[IMPORT] content-type: ${contentType}`);
    console.log(`[IMPORT] response preview: ${html.slice(0, 300)}`);

    const entries = this.parseTableRows(html);
    console.log(`[IMPORT] rows found: ${entries.length}`);
    console.log(`[IMPORT] candidate files: ${entries.map((e) => e.filename).join(', ') || 'none'}`);

    const filtered = entries.filter(
      (e) => e.filename.startsWith('PriceFull') && e.filename.includes(`-${STORE_ID}-`),
    );

    console.log(`[IMPORT] files found: ${filtered.length}`);

    if (filtered.length === 0) {
      console.log(`[IMPORT] no PriceFull file found for storeId: ${STORE_ID}`);
      return null;
    }

    // Pick newest by lex sort — timestamp is embedded in the filename
    const latest = filtered.reduce((a, b) => (b.filename.localeCompare(a.filename) > 0 ? b : a));
    console.log(`[IMPORT] selected file: ${latest.filename}`);

    try {
      const rawData = await downloadFile(latest.downloadUrl);
      console.log(`[IMPORT] download success: ${latest.filename} (${rawData.length} bytes)`);
      return { filename: latest.filename, rawData };
    } catch (err) {
      console.error(
        `[IMPORT] download failure: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Parse <tr class="webgrid-row-style"> rows from the HTML table.
   * The first <a href="..."> in each row is the signed Azure Blob download URL.
   * The filename is the last path segment of that URL (before the "?" query string).
   */
  private parseTableRows(html: string): FileEntry[] {
    const entries: FileEntry[] = [];
    const rowRe = /<tr[^>]*class="webgrid-row-style"[^>]*>([\s\S]*?)<\/tr>/gi;
    const hrefRe = /<a\s+[^>]*href="([^"]+)"/i;

    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(html)) !== null) {
      const rowHtml = rowMatch[1];
      const hrefMatch = hrefRe.exec(rowHtml);
      if (!hrefMatch) continue;

      // HTML-decode &amp; that browsers render as &
      const downloadUrl = hrefMatch[1].replace(/&amp;/g, '&');

      try {
        const pathname = new URL(downloadUrl).pathname;
        const filename = pathname.split('/').pop();
        if (filename) {
          entries.push({ filename, downloadUrl });
        }
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
