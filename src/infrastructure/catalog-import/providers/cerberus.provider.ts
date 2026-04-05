/**
 * CerberusProvider — handles all interaction with the Cerberus price-file platform
 * (url.retail.publishedprices.co.il) used by Rami Levi, Osher Ad, and other chains.
 *
 * Login flow (two-step — CSRF + full cookie jar required):
 *  1. GET /login  → collect ALL Set-Cookie headers + extract csrftoken from HTML
 *  2. POST /login with user, csrftoken, Referer, Origin + full cookie jar
 *  3. Merge any new cookies from POST response into the jar
 *  4. GET /file/json/dir with full cookie jar → JSON array of { name, ... }
 *  5. Filter + pick newest PriceFull file
 *  6. GET /file/d/<filename> → download (may redirect to CDN)
 */
import https from 'https';
import { URL } from 'url';

const BASE_URL = 'https://url.retail.publishedprices.co.il';
const CERBERUS_HOSTNAME = new URL(BASE_URL).hostname;

export interface ProviderFile {
  filename: string;
  rawData: Buffer;
}

// ─── Minimal cookie jar ───────────────────────────────────────────────────────

/** Parse Set-Cookie headers and return a name→value map of all cookies. */
function parseSetCookies(headers: string[]): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const header of headers) {
    const [pair] = header.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) {
      jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
  }
  return jar;
}

/** Merge new cookies into an existing jar (new values win). */
function mergeCookies(
  jar: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  return { ...jar, ...incoming };
}

/** Serialise a cookie jar into a Cookie header value. */
function serializeCookies(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class CerberusProvider {
  constructor(
    private readonly username: string,
    private readonly storeId?: string,
  ) {}

  // Read env at call time — NOT at module load time — so dotenv has already run.
  private get tlsAgent(): https.Agent | undefined {
    const raw = String(process.env.CERBERUS_INSECURE_TLS ?? '')
      .trim()
      .toLowerCase();
    const insecure = raw === 'true';
    console.log(`[IMPORT] CERBERUS_INSECURE_TLS raw="${raw}" insecure=${insecure}`);
    return insecure ? new https.Agent({ rejectUnauthorized: false }) : undefined;
  }

  async getLatestFile(): Promise<ProviderFile | null> {
    console.log(`[IMPORT] CerberusProvider start — user: ${this.username}`);
    console.log(`[IMPORT] source: ${BASE_URL}`);

    const cookieJar = await this.login();
    const allFiles = await this.listFiles(cookieJar);

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
      const rawData = await this.download(downloadUrl, cookieJar);
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
   * Two-step login. Returns a fully populated cookie jar for use on all
   * subsequent requests within this import run.
   */
  private async login(): Promise<Record<string, string>> {
    const loginUrl = `${BASE_URL}/login`;
    console.log(`[IMPORT] login step 1 — GET ${loginUrl}`);

    const { jar: jar1, csrf } = await this.fetchLoginPage();
    console.log(`[IMPORT] cookies after GET /login: ${JSON.stringify(Object.keys(jar1))}`);

    console.log(
      `[IMPORT] login step 2 — POST ${loginUrl} user=${this.username} csrf=${csrf.slice(0, 8)}...`,
    );
    const jar2 = await this.postLogin(jar1, csrf);
    console.log(`[IMPORT] cookies after POST /login: ${JSON.stringify(Object.keys(jar2))}`);

    return jar2;
  }

  private fetchLoginPage(): Promise<{ jar: Record<string, string>; csrf: string }> {
    const agent = this.tlsAgent;
    return new Promise((resolve, reject) => {
      const req = https.get({ hostname: CERBERUS_HOSTNAME, path: '/login', agent }, (res) => {
        console.log(
          `[IMPORT] GET /login — status=${res.statusCode} content-type=${res.headers['content-type']}`,
        );
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          console.log(`[IMPORT] GET /login body preview: ${body.slice(0, 300)}`);

          const jar = parseSetCookies(res.headers['set-cookie'] ?? []);

          const csrfMatch = body.match(/csrftoken"\s+content="([^"]+)"/);
          if (!csrfMatch) {
            reject(new Error('Cerberus login page: csrftoken not found in HTML'));
            return;
          }
          resolve({ jar, csrf: csrfMatch[1] });
        });
        res.on('error', reject);
      });
      req.on('error', reject);
    });
  }

  private postLogin(jar: Record<string, string>, csrf: string): Promise<Record<string, string>> {
    const agent = this.tlsAgent;
    const body = `user=${encodeURIComponent(this.username)}&password=&csrftoken=${encodeURIComponent(csrf)}`;
    const cookieHeader = serializeCookies(jar);

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
            Cookie: cookieHeader,
            Referer: `${BASE_URL}/login`,
            Origin: BASE_URL,
          },
        },
        (res) => {
          console.log(
            `[IMPORT] POST /login — status=${res.statusCode} location=${res.headers['location'] ?? 'none'}`,
          );
          res.resume(); // drain body
          const incoming = parseSetCookies(res.headers['set-cookie'] ?? []);
          const merged = mergeCookies(jar, incoming);
          resolve(merged);
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private listFiles(jar: Record<string, string>): Promise<string[]> {
    const listUrl = `${BASE_URL}/file/json/dir`;
    const cookieHeader = serializeCookies(jar);
    console.log(`[IMPORT] listing files — GET ${listUrl}`);
    const agent = this.tlsAgent;

    return new Promise((resolve, reject) => {
      const req = https.get(
        {
          hostname: CERBERUS_HOSTNAME,
          path: '/file/json/dir',
          agent,
          headers: { Cookie: cookieHeader },
        },
        (res) => {
          const contentType = res.headers['content-type'] ?? 'unknown';
          const location = res.headers['location'] ?? '';
          console.log(
            `[IMPORT] GET /file/json/dir — status=${res.statusCode} content-type=${contentType} location=${location || 'none'}`,
          );

          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            console.log(`[IMPORT] /file/json/dir body preview: ${body.slice(0, 400)}`);

            if (res.statusCode === 302 || res.statusCode === 301) {
              reject(
                new Error(
                  `Cerberus listing redirected to "${location}" (status=${res.statusCode}). ` +
                    `Session is not authenticated. Login failed for user="${this.username}".`,
                ),
              );
              return;
            }

            if (contentType.includes('text/html')) {
              reject(
                new Error(
                  `Cerberus listing returned HTML instead of JSON (status=${res.statusCode}). ` +
                    `Session may not be authenticated for user="${this.username}".`,
                ),
              );
              return;
            }

            try {
              const json: unknown = JSON.parse(body);
              const names = Array.isArray(json)
                ? (json as Array<{ name?: string }>).map((f) => f.name ?? '').filter(Boolean)
                : [];
              resolve(names);
            } catch {
              reject(
                new Error(`Cerberus listing: failed to parse JSON — body: ${body.slice(0, 200)}`),
              );
            }
          });
          res.on('error', reject);
        },
      );
      req.on('error', reject);
    });
  }

  private download(url: string, jar: Record<string, string>, redirectsLeft = 5): Promise<Buffer> {
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
          headers: isCerberusHost ? { Cookie: serializeCookies(jar) } : {},
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
            const next = new URL(headers.location, url).href;
            // Pass empty jar for CDN hops — they don't need the session cookie
            this.download(next, {}, redirectsLeft - 1).then(resolve, reject);
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
