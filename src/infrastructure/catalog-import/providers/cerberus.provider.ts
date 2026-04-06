/**
 * CerberusProvider — fetches price files from the Cerberus FTPS server
 * (url.retail.publishedprices.co.il, port 21) used by Rami Levi, Osher Ad, and other chains.
 *
 * Flow (identical to the reference Python scraper):
 *  1. Connect via explicit FTPS: plain TCP on port 21, then AUTH TLS (= Python FTP_TLS)
 *  2. Login with username + empty password
 *     useDefaultSettings() then sends PBSZ 0 + PROT P to protect data connections
 *  3. List files in the root directory
 *  4. Filter to PriceFull files, optionally by storeId
 *  5. Pick the newest file by filename (timestamp embedded)
 *  6. Download file to memory as a Buffer
 *  7. Close connection
 */
import { Client as FtpClient, enterPassiveModeIPv4 } from 'basic-ftp';
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

    // Force passive IPv4 — prevents ECONNRESET on data socket TLS handshake
    // when the server returns an IPv6 or NAT-unfriendly PASV address.
    client.prepareTransfer = enterPassiveModeIPv4;

    // Pipe basic-ftp's internal log to our logger so we can see AUTH TLS / PBSZ / PROT P
    client.ftp.log = (msg: string) => {
      if (msg.match(/AUTH|PBSZ|PROT|TLS|Login|security/i)) {
        console.log(`[IMPORT][FTP] ${msg}`);
      }
    };

    console.log(
      `[IMPORT] connecting — host: ${FTP_HOST} port: ${FTP_PORT} secure: true (explicit AUTH TLS) passiveIPv4: forced`,
    );

    try {
      await client.access({
        host: FTP_HOST,
        port: FTP_PORT,
        user: this.username,
        password: FTP_PASSWORD,
        secure: true, // explicit TLS: plain connect on port 21, then AUTH TLS — matches Python FTP_TLS
        secureOptions: {
          rejectUnauthorized: false, // debugging — server cert chain is incomplete
          minVersion: 'TLSv1.2',
          maxVersion: 'TLSv1.2',
        },
      });
      // At this point basic-ftp has completed: AUTH TLS → PBSZ 0 → PROT P → login
      console.log(
        `[IMPORT] FTP login success — user: ${this.username} hasTLS: ${client.ftp.hasTLS}`,
      );

      // pwd confirms the session is fully alive before issuing LIST
      const pwd = await client.pwd();
      console.log(`[IMPORT] pwd: ${pwd}`);

      // List all files in root — retry once on ECONNRESET (transient data-socket TLS failure)
      console.log(`[IMPORT] list start — path: /`);
      let listing;
      try {
        listing = await client.list('/');
      } catch (listErr) {
        const listErrCode = (listErr as NodeJS.ErrnoException).code ?? '';
        console.warn(`[IMPORT] list attempt 1 failed — code: ${listErrCode} — retrying`);
        listing = await client.list('/');
      }
      const allNames = listing.filter((f) => f.isFile).map((f) => f.name);
      console.log(`[IMPORT] list end — total files: ${allNames.length}`);

      // Build a storeId regex once — strips leading zeros, matches both padded/unpadded
      const storeIdRe = this.storeId
        ? new RegExp(`-0*${this.storeId.replace(/^0+/, '') || this.storeId}-`)
        : null;

      const matchesStore = (name: string) => !storeIdRe || storeIdRe.test(name);
      const isValidExt = (name: string) => /\.(xml|gz)$/i.test(name);

      // Select PriceFull files only for this storeId
      const priceFullFiles = allNames.filter(
        (name) =>
          name.toLowerCase().startsWith('pricefull') && isValidExt(name) && matchesStore(name),
      );

      console.log(
        `[IMPORT] PriceFull candidates: ${priceFullFiles.length} storeId: ${this.storeId ?? 'any'}`,
      );

      if (priceFullFiles.length === 0) {
        console.log(`[IMPORT] no PriceFull file found for storeId: ${this.storeId ?? 'any'}`);
        return null;
      }

      // Pick newest by lex sort — timestamp is embedded in the filename
      const latest = priceFullFiles.reduce((a, b) => (b.localeCompare(a) > 0 ? b : a));
      console.log(`[IMPORT] selected file: ${latest} storeId: ${this.storeId ?? 'any'}`);

      // Download to memory
      console.log(`[IMPORT] download start — file: ${latest}`);
      const rawData = await this.downloadToBuffer(client, latest);
      console.log(`[IMPORT] download end — file: ${latest} size: ${rawData.length} bytes`);

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
