/**
 * CerberusProvider — handles all interaction with the Cerberus price-file platform
 * (url.publishedprices.co.il) used by Rami Levi, Osher Ad, and other chains.
 *
 * Responsibilities:
 *  - session login (username + empty password)
 *  - listing available files via the JSON API
 *  - filtering to PriceFull files, optionally by storeId
 *  - picking the newest file
 *  - downloading the raw file bytes
 */
import https from 'https';
import { URL } from 'url';

const BASE_URL = 'https://url.publishedprices.co.il';

// When CERBERUS_INSECURE_TLS=true, bypass certificate verification for this
// host only (incomplete chain on url.publishedprices.co.il in some Node versions).
// Never enabled in production — SSL verification stays on unless the flag is set.
const insecureTls = process.env.CERBERUS_INSECURE_TLS === 'true';
const tlsAgent = insecureTls ? new https.Agent({ rejectUnauthorized: false }) : undefined;

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
    console.log(`[IMPORT] CerberusProvider start — user: ${this.username}`);
    console.log(`[IMPORT] source: ${BASE_URL}`);
    console.log(`[IMPORT] TLS insecure mode: ${insecureTls}`);

    const cookie = await this.login();
    const allFiles = await this.listFiles(cookie);

    const filtered = allFiles.filter((name) => {
      if (!name.startsWith('PriceFull')) return false;
      if (!this.storeId) return true;
      const id = this.storeId.replace(/^0+/, '') || this.storeId;
      return new RegExp(`-0*${id}-`).test(name);
    });

    console.log(`[IMPORT] files found: ${filtered.length}`);

    if (filtered.length === 0) {
      console.log(`[IMPORT] no PriceFull file found — storeId: ${this.storeId ?? 'any'}`);
      return null;
    }

    const latest = filtered.reduce((a, b) => (b.localeCompare(a) > 0 ? b : a));
    console.log(`[IMPORT] selected file: ${latest}`);

    const downloadUrl = `${BASE_URL}/file/d/${latest}`;
    console.log(`[IMPORT] downloading: ${downloadUrl}`);
    try {
      const rawData = await this.download(downloadUrl, cookie);
      console.log(`[IMPORT] download success: ${latest} (${rawData.length} bytes)`);
      return { filename: latest, rawData };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[IMPORT] download failure — url: ${downloadUrl} code: ${code} message: ${message}`);
      throw err;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private login(): Promise<string> {
    const body = `user=${encodeURIComponent(this.username)}&password=`;
    const loginUrl = `${BASE_URL}/login`;
    console.log(`[IMPORT] login url: ${loginUrl}`);
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: new URL(BASE_URL).hostname,
          path: '/login',
          method: 'POST',
          agent: tlsAgent,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          res.resume(); // drain body — we only need the cookie
          const cookies = res.headers['set-cookie'] ?? [];
          const entry = cookies.find((c) => c.startsWith('cftpSID='));
          if (!entry) {
            reject(new Error(`Cerberus login failed for "${this.username}": no session cookie`));
            return;
          }
          resolve(entry.split(';')[0]); // "cftpSID=VALUE"
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private listFiles(cookie: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        {
          hostname: new URL(BASE_URL).hostname,
          path: '/file/json/dir',
          agent: tlsAgent,
          headers: { Cookie: cookie },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            try {
              const json: unknown = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
              const names = Array.isArray(json)
                ? (json as Array<{ name?: string }>).map((f) => f.name ?? '').filter(Boolean)
                : [];
              resolve(names);
            } catch {
              reject(new Error('Failed to parse Cerberus file listing JSON'));
            }
          });
          res.on('error', reject);
        },
      );
      req.on('error', reject);
    });
  }

  private download(url: string, cookie: string, redirectsLeft = 5): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      // CDN redirects land on a different hostname — only attach the insecure agent
      // for the Cerberus host; CDN responses use valid certs and don't need it.
      const isCerberusHost = parsed.hostname === new URL(BASE_URL).hostname;
      const req = https.get(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          agent: isCerberusHost ? tlsAgent : undefined,
          headers: cookie ? { Cookie: cookie } : {},
        },
        (res) => {
          const { statusCode, headers } = res;
          if (
            (statusCode === 301 ||
              statusCode === 302 ||
              statusCode === 307 ||
              statusCode === 308) &&
            headers.location
          ) {
            res.resume();
            if (redirectsLeft <= 0) {
              reject(new Error(`Too many redirects downloading: ${url}`));
              return;
            }
            // CDN redirects don't need the session cookie
            const next = new URL(headers.location, url).href;
            this.download(next, '', redirectsLeft - 1).then(resolve, reject);
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        },
      );
      req.on('error', reject);
    });
  }
}
