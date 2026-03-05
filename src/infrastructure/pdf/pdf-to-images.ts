import * as path from 'path';
import { pathToFileURL } from 'url';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { AppError } from '../../errors/app-error';

// pdfjs-dist v5 expects these DOM globals in Node.js environments.
// @napi-rs/canvas (already an optional dep of pdfjs-dist) provides compatible
// implementations. We polyfill them once at module load time.
// On Node.js >= 22.3 pdfjs-dist does this automatically via process.getBuiltinModule;
// on Node.js 22.2 (our current runtime) we do it manually.
if (!('DOMMatrix' in global)) (global as Record<string, unknown>).DOMMatrix = DOMMatrix;
if (!('ImageData' in global)) (global as Record<string, unknown>).ImageData = ImageData;
if (!('Path2D' in global)) (global as Record<string, unknown>).Path2D = Path2D;

const MAX_PAGES = 10;
const RENDER_SCALE = 2.0; // 2× ≈ 150 DPI — good balance of OCR quality vs memory

// pdfjs-dist v5 is ESM-only.  CommonJS cannot statically import it, so we bridge
// via `new Function('return import(...)')()` which TypeScript leaves as-is at
// compile time and Node.js resolves as a true dynamic ESM import at runtime.
// The module is cached after the first load.
type PdfjsModule = typeof import('pdfjs-dist');
let pdfjsCache: PdfjsModule | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (pdfjsCache) return pdfjsCache;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const pdfjs = (await new Function(
    'return import("pdfjs-dist/legacy/build/pdf.mjs")',
  )()) as PdfjsModule;

  // Point to the bundled worker script (required in Node.js — no browser Worker API).
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  pdfjsCache = pdfjs;
  return pdfjs;
}

/**
 * Converts a PDF buffer into one PNG image buffer per page (up to MAX_PAGES).
 * Each buffer is suitable for passing directly to the Google Vision OCR provider.
 * Throws AppError 422 if the buffer is not a valid PDF.
 */
export async function pdfToImageBuffers(pdfBuffer: Buffer): Promise<Buffer[]> {
  const pdfjs = await loadPdfjs();

  let doc: Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  } catch {
    throw new AppError('Failed to parse PDF file — file may be corrupted or password-protected', 422);
  }

  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  const buffers: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext('2d');

    await page.render({
      // @napi-rs/canvas is API-compatible with HTMLCanvasElement/CanvasRenderingContext2D
      // but has its own types — cast to satisfy pdfjs-dist v5 RenderParameters.
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    buffers.push(canvas.toBuffer('image/png'));
    page.cleanup();
  }

  return buffers;
}

// ─── Text Layer Extraction ────────────────────────────────────────────────────

// Minimal shape of a pdfjs TextItem we need (transform[4]=x, transform[5]=y).
interface PdfjsTextItem {
  str: string;
  transform: number[]; // affine: [a, b, c, d, x, y]
}

/**
 * Groups raw text items from pdfjs into text lines by y-coordinate proximity.
 * Items within Y_THRESHOLD units of the same y are placed on the same "row".
 * Rows are sorted top-to-bottom (y descending — PDF y increases upward).
 * Within each row items keep the order pdfjs emits them (logical reading order,
 * which is correct for RTL Hebrew because pdfjs follows the PDF content stream).
 */
function buildTextLines(items: PdfjsTextItem[]): string[] {
  const Y_THRESHOLD = 3;
  const rows: { y: number; text: string }[] = [];

  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = item.transform[5];
    const existing = rows.find((r) => Math.abs(r.y - y) <= Y_THRESHOLD);
    if (existing) {
      existing.text += ' ' + item.str;
    } else {
      rows.push({ y, text: item.str });
    }
  }

  return rows
    .sort((a, b) => b.y - a.y) // top-of-page first
    .map((r) => r.text.trim())
    .filter(Boolean);
}

/**
 * Attempts to extract the embedded text layer from a PDF buffer.
 * Returns the reconstructed text (with page separators) when meaningful,
 * or null when the PDF has no extractable text (scanned image PDF).
 *
 * Meaningfulness heuristic: length > 200 AND at least 5 price-like patterns,
 * or at least 2 with a ₪ symbol.  This prevents returning gibberish extracted
 * from PDFs that embed fonts but contain no real text content.
 */
export async function extractPdfTextLayer(pdfBuffer: Buffer): Promise<string | null> {
  const pdfjs = await loadPdfjs();

  let doc: Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  } catch {
    return null; // not a valid PDF or locked — caller will fall back to image OCR
  }

  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  const pageParts: string[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const lines = buildTextLines(content.items as PdfjsTextItem[]);
    pageParts.push(`\n\n--- PAGE ${pageNum} ---\n\n${lines.join('\n')}`);
    page.cleanup();
  }

  const fullText = pageParts.join('\n');
  const priceMatches = (fullText.match(/\d+[.,]\d{2}/g) ?? []).length;
  const hasShekels = fullText.includes('₪');
  const meaningful =
    fullText.length > 200 && (priceMatches >= 5 || (priceMatches >= 2 && hasShekels));

  return meaningful ? fullText : null;
}

/**
 * The absolute path to the worker script, exported so callers can log it or
 * pre-warm the module in integration tests.
 */
export const PDF_WORKER_PATH: string = path.resolve(
  path.dirname(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')),
  'pdf.worker.mjs',
);
