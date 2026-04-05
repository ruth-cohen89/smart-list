/**
 * CerberusProvider — handles all interaction with the Cerberus price-file platform
 * (url.retail.publishedprices.co.il) used by Rami Levi, Osher Ad, and other chains.
 *
 * Login flow (two-step — CSRF required):
 *  1. GET /login  → obtain session cookie + csrftoken meta tag
 *  2. POST /login with user, password, csrftoken → session is now authenticated
 *  3. GET /file/json/dir → JSON array of { name, ... } file entries
 *  4. Filter + pick newest PriceFull file
 *  5. GET /file/d/<filename> → download (may redirect to CDN)
 */
import https from 'https';
import { URL } from 'url';

const BASE_URL = 'https://url.retail.publishedprices.co.il';
const CERBERUS_HOSTNAME = new URL(BASE_URL).hostname;

export interface ProviderFile {
  filename: string;
  rawData: Buffer;
}

export class CerberusProvider {
  constructor(
    private readonly username: string,
    private readonly storeId?: string,
  ) {}

  // Read env at call time — NOT at module load time — so dotenv has already run.
  private get tlsAgent(): https.Agent | undefined {
    const raw = String(process.env.CERBERUS_INSECURE_TLS ?? '').trim().toLowerCase();
    const insecure = raw === 'true';
    console.log(`[IMPORT] CERBERUS_INSECURE_TLS raw="${raw}" insecure=${insecure}`);
    return insecure ? new https.Agent({ rejectUnauthorized: false }) : undefined;
  }

  async getLatestFile(): Promise<ProviderFile | null> {
    console.log(`[IMPORT] CerberusProvider start — user: ${this.username}`);
    console.log(`[IMPORT] source: ${BASE_URL}`);

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
      console.error(
        `[IMPORT] download failure — url: ${downloadUrl} code: ${code} message: ${message}`,
      );
      throw err;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Two-step login required by the retail Cerberus instance:
   *  Step 1 — GET /login to receive the initial session cookie and csrftoken.
   *  Step 2 — POST /login with user + csrftoken using the step-1 cookie.
   *           A successful login keeps the same cookie but marks the session
   *           authenticated server-side; an unsuccessful login rotates nothing
   *           and every subsequent request redirects to /login.
   */
  private async login(): Promise<string> {
    const loginUrl = `${BASE_URL}/login`;
    console.log(`[IMPORT] login step 1 — GET ${loginUrl}`);

    const { cookie: initCookie, csrf } = await this.fetchLoginPage();
    console.log(`[IMPORT] login step 2 — POST ${loginUrl} user=${this.username} csrf=${csrf.slice(0, 8)}...`);

    return this.postLogin(initCookie, csrf);
  }

  private fetchLoginPage(): Promise<{ cookie: string; csrf: string }> {
    const agent = this.tlsAgent;
    return new Promise((resolve, reject) => {
      const req = https.get(
        { hostname: CERBERUS_HOSTNAME, path: '/login', agent },
        (res) => {
          console.log(`[IMPORT] GET /login — status=${res.statusCode} content-type=${res.headers['content-type']}`);
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            console.log(`[IMPORT] GET /login body preview: ${body.slice(0, 300)}`);

            const cookies = res.headers['set-cookie'] ?? [];
            const cookieEntry = cookies.find((c) => c.startsWith('cftpSID='));
            if (!cookieEntry) {
              reject(new Error('Cerberus login page: no session cookie in response'));
              return;
            }
            const cookie = cookieEntry.split(';')[0]; // "cftpSID=VALUE"

            const csrfMatch = body.match(/csrftoken"\s+content="([^"]+)"/);
            if (!csrfMatch) {
              reject(new Error('Cerberus login page: csrftoken not found in HTML'));
              return;
            }
            resolve({ cookie, csrf: csrfMatch[1] });
          });
          res.on('error', reject);
        },
      );
      req.on('error', reject);
    });
  }

  private postLogin(initCookie: string, csrf: string): Promise<string> {
    const agent = this.tlsAgent;
    const body = `user=${encodeURIComponent(this.username)}&password=&csrftoken=${encodeURIComponent(csrf)}`;
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: CERBERUS_HOSTNAME,
          path: '/login',
          method: 'POST',
          agent,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
            Cookie: initCookie,
          },
        },
        (res) => {
          console.log(`[IMPORT] POST /login — status=${res.statusCode}`);
          res.resume(); // drain body — we only need the cookie
          const cookies = res.headers['set-cookie'] ?? [];
          const entry = cookies.find((c) => c.startsWith('cftpSID='));
          if (!entry) {
            reject(new Error(`Cerberus login failed for "${this.username}": no session cookie in POST response`));
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
    const listUrl = `${BASE_URL}/file/json/dir`;
    console.log(`[IMPORT] listing files — GET ${listUrl}`);
    const agent = this.tlsAgent;
    return new Promise((resolve, reject) => {
      const req = https.get(
        { hostname: CERBERUS_HOSTNAME, path: '/file/json/dir', agent, headers: { Cookie: cookie } },
        (res) => {
          const contentType = res.headers['content-type'] ?? 'unknown';
          console.log(`[IMPORT] GET /file/json/dir — status=${res.statusCode} content-type=${contentType}`);

          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            console.log(`[IMPORT] /file/json/dir body preview: ${body.slice(0, 400)}`);

            if (contentType.includes('text/html')) {
              reject(new Error(
                `Cerberus listing returned HTML instead of JSON (status=${res.statusCode}). ` +
                `Session may not be authenticated. Check credentials for user="${this.username}".`,
              ));
              return;
            }

            try {
              const json: unknown = JSON.parse(body);
              const names = Array.isArray(json)
                ? (json as Array<{ name?: string }>).map((f) => f.name ?? '').filter(Boolean)
                : [];
              resolve(names);
            } catch {
              reject(new Error(`Cerberus listing: failed to parse JSON response — body: ${body.slice(0, 200)}`));
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
      const isCerberusHost = parsed.hostname === CERBERUS_HOSTNAME;
      const req = https.get(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          agent: isCerberusHost ? this.tlsAgent : undefined,
          headers: cookie ? { Cookie: cookie } : {},
        },
        (res) => {
          const { statusCode, headers } = res;
          if (
            (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) &&
            headers.location
          ) {
            res.resume();
            if (redirectsLeft <= 0) {
              reject(new Error(`Too many redirects downloading: ${url}`));
              return;
            }
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
