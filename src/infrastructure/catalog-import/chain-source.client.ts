/**
 * Low-level HTTP + decompression utilities for fetching supermarket price files.
 * No chain-specific logic lives here — just generic fetch / decompress helpers.
 * Uses Node built-in modules only (https, http, zlib) — no extra dependencies.
 */
import https from 'https';
import http from 'http';
import zlib from 'zlib';
import { URL } from 'url';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileEntry {
  filename: string;
  downloadUrl: string;
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

const MAX_REDIRECTS = 5;
/** ms before a single request is aborted — keeps import jobs from hanging */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * GET a URL and return the raw response body as a Buffer.
 * Follows up to MAX_REDIRECTS redirects (301 / 302 / 307 / 308).
 */
function httpGet(rawUrl: string, redirectsLeft = MAX_REDIRECTS): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      reject(new Error(`Invalid URL: ${rawUrl}`));
      return;
    }

    const protocol = parsed.protocol === 'https:' ? https : http;

    const req = protocol.get(rawUrl, (res) => {
      const { statusCode, headers } = res;

      // Follow redirects
      if (
        (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) &&
        headers.location
      ) {
        res.resume(); // drain the response body
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects fetching: ${rawUrl}`));
          return;
        }
        const next = new URL(headers.location, rawUrl).href;
        httpGet(next, redirectsLeft - 1).then(resolve, reject);
        return;
      }

      if (statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${statusCode} fetching: ${rawUrl}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timeout (${REQUEST_TIMEOUT_MS}ms): ${rawUrl}`));
    });
    req.on('error', reject);
  });
}

// ─── Listing + filtering ──────────────────────────────────────────────────────

/**
 * Fetch the listing page for a chain and return it as a string.
 * Works for HTML directory pages and custom web pages alike.
 */
export async function fetchListingPage(url: string): Promise<string> {
  const buf = await httpGet(url);
  return buf.toString('utf-8');
}

/**
 * Extract file entries from an HTML listing page.
 * Scans all href attributes for links that look like price XML files.
 * The base URL is used to resolve relative hrefs into absolute download URLs.
 */
export function parseFileLinks(html: string, baseUrl: string): FileEntry[] {
  // Match href="..." or href='...' containing PriceFull*.xml or PriceFull*.xml.gz
  const linkRe = /href=["']([^"']*PriceFull[^"']*\.xml(?:\.gz)?)["']/gi;
  const entries: FileEntry[] = [];
  let m: RegExpExecArray | null;

  while ((m = linkRe.exec(html)) !== null) {
    const raw = m[1];
    try {
      const downloadUrl = new URL(raw, baseUrl).href;
      // Take the last path segment as the filename
      const filename = raw.split('/').pop() ?? raw;
      entries.push({ filename, downloadUrl });
    } catch {
      // skip malformed hrefs
    }
  }

  return entries;
}

/**
 * Filter a list of file entries to only those matching the expected file type
 * prefix (e.g. "PriceFull") and the target store ID.
 *
 * Israeli price file naming convention:
 *   {prefix}{chainCode}-{storeId}-{YYYYMMDDHHII}.xml[.gz]
 *
 * Store IDs may appear with or without leading zeros (e.g. "039" vs "39"),
 * so we strip leading zeros from both sides before comparing.
 */
export function filterFiles(files: FileEntry[], prefix: string, storeId: string): FileEntry[] {
  // Normalise the store ID for comparison: strip leading zeros, keep at least one digit
  const normalizedId = storeId.replace(/^0+/, '') || storeId;
  // Matches: PriceFull...-{0*}{normalizedId}-...
  const re = new RegExp(`^${prefix}[^-]*-0*${normalizedId}-.*\\.xml`, 'i');
  return files.filter((f) => re.test(f.filename));
}

/**
 * From a non-empty list of file entries, return the one with the lexicographically
 * largest filename. Because the timestamp (YYYYMMDDHHII) is embedded in the name,
 * this reliably picks the most recent file.
 */
export function pickLatestFile(files: FileEntry[]): FileEntry | null {
  if (files.length === 0) return null;
  return files.reduce((latest, f) => (f.filename.localeCompare(latest.filename) > 0 ? f : latest));
}

// ─── Download + decompress ────────────────────────────────────────────────────

/** Download a file and return the raw bytes. */
export async function downloadFile(url: string): Promise<Buffer> {
  return httpGet(url);
}

/**
 * Decompress a buffer if it is gzip-encoded (magic bytes 0x1F 0x8B),
 * otherwise return it unchanged.
 * This handles both .xml.gz and plain .xml files transparently.
 */
export function decompressIfNeeded(data: Buffer): Promise<Buffer> {
  const isGzip = data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
  if (!isGzip) return Promise.resolve(data);

  return new Promise((resolve, reject) => {
    zlib.gunzip(data, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
