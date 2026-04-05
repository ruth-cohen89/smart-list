/**
 * CerberusProvider — fetches price files from the Cerberus FTPS server
 * (url.retail.publishedprices.co.il, port 21) used by Rami Levi, Osher Ad, and other chains.
 *
 * Flow (identical to the reference Python scraper):
 *  1. Connect via FTPS (FTP over TLS, implicit or explicit)
 *  2. Login with username + empty password
 *  3. List files in the root directory
 *  4. Filter to PriceFull files, optionally by storeId
 *  5. Pick the newest file by filename (timestamp embedded)
 *  6. Download file to memory as a Buffer
 *  7. Close connection
 */
import { Client as FtpClient } from 'basic-ftp';
import { PassThrough } from 'stream';

const FTP_HOST = 'url.retail.publishedprices.co.il';
const FTP_PORT = 21;
const FTP_PASSWORD = ''; // Cerberus chains use empty password

export interface ProviderFile {
  filename: string;
  rawData: Buffer;
}

export class CerberusProvider {
  constructor(
    private readonly username: string,
    private readonly storeId?: string,
  ) {}

  async getLatestFile(): Promise<ProviderFile | null> {
    console.log(`[IMPORT] CerberusProvider start — user: ${this.username} host: ${FTP_HOST}`);

    const client = new FtpClient();
    client.ftp.verbose = false; // set true to see raw FTP commands

    try {
      await client.access({
        host: FTP_HOST,
        port: FTP_PORT,
        user: this.username,
        password: FTP_PASSWORD,
        secure: 'implicit', // FTPS — matches Python FTP_TLS behaviour
        secureOptions: { rejectUnauthorized: false }, // same cert issue as HTTP side
      });
      console.log(`[IMPORT] FTP connected — user: ${this.username}`);

      // List all files in root
      const listing = await client.list('/');
      const allNames = listing.filter((f) => f.isFile).map((f) => f.name);

      console.log(`[IMPORT] FTP total files listed: ${allNames.length}`);

      // Filter to PriceFull files, optionally matching storeId
      const filtered = allNames.filter((name) => {
        if (!name.toLowerCase().startsWith('pricefull')) return false;
        if (!name.match(/\.(xml|gz)$/i)) return false;
        if (!this.storeId) return true;
        const id = this.storeId.replace(/^0+/, '') || this.storeId;
        return new RegExp(`-0*${id}-`).test(name);
      });

      console.log(
        `[IMPORT] files found after filter: ${filtered.length} storeId: ${this.storeId ?? 'any'}`,
      );

      if (filtered.length === 0) {
        console.log(`[IMPORT] no PriceFull file found`);
        return null;
      }

      // Pick newest by lex sort — timestamp is embedded in the filename
      const latest = filtered.reduce((a, b) => (b.localeCompare(a) > 0 ? b : a));
      console.log(`[IMPORT] selected file: ${latest}`);

      // Download to memory
      const rawData = await this.downloadToBuffer(client, latest);
      console.log(`[IMPORT] download success: ${latest} (${rawData.length} bytes)`);

      return { filename: latest, rawData };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[IMPORT] FTP failure — user: ${this.username} code: ${code} message: ${message}`,
      );
      throw err;
    } finally {
      client.close();
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private downloadToBuffer(client: FtpClient, filename: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const pass = new PassThrough();
      const chunks: Buffer[] = [];

      pass.on('data', (chunk: Buffer) => chunks.push(chunk));
      pass.on('error', reject);
      pass.on('end', () => resolve(Buffer.concat(chunks)));

      client.downloadTo(pass, filename).catch(reject);
    });
  }
}
