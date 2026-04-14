export const normalizeName = (name: string): string => {
  if (!name) return '';

  return name
    .normalize('NFKC')
    .replace(/["'`׳״]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

// ─── Product-matching normalization ─────────────────────────────────────────
// Stronger normalization for comparing chain-product names against group
// keywords. Strips marketing fluff, normalizes units and percentages.

const STOPWORDS = new Set([
  'מבצע', 'חדש', 'מהדרין', 'איכותי', 'פרימיום', 'מיוחד',
  'משתלם', 'חסכוני', 'מומלץ', 'הנחה', 'במבצע', 'סייל',
  'בלעדי', 'מוזל', 'מנדטורי', 'טבעי',
]);

const UNIT_MAP: [RegExp, string][] = [
  [/ק"ג|קילו(?:גרם)?/g, 'kg'],
  [/(\d)\s?גר(?:ם)?/g, '$1g'],
  [/ליטר|ל'/g, 'liter'],
  [/מ"ל|מיליליטר/g, 'ml'],
];

const PERCENT_RE = /(\d+)\s*(?:אחוז|%)/g;

/**
 * Heavier normalization for product matching.
 * - Strips stopwords (marketing fluff)
 * - Normalizes units (ק"ג → kg, ליטר → liter, etc.)
 * - Normalizes percentages (3 אחוז → 3%)
 * - Keeps `%` so "3%" and "1%" remain distinct tokens and don't
 *   false-match bare numbers like "1" in "1 ליטר".
 *
 * IMPORTANT: score candidates using `normalizeForMatching(originalName)`,
 * not `normalizeForMatching(normalizedName)`, because `normalizeName` already
 * stripped the `%` character.
 */
export const normalizeForMatching = (text: string): string => {
  if (!text) return '';

  // Start with the raw text, apply unit + percent transforms before
  // the base normalization strips the special characters they rely on.
  let s = text.normalize('NFKC');

  // Units — must run before quote-stripping
  for (const [re, replacement] of UNIT_MAP) {
    s = s.replace(re, replacement);
  }

  // Percentages — normalize "3 אחוז" → "3%"
  s = s.replace(PERCENT_RE, '$1%');

  // Standard normalization pipeline — keep `%` so percentage tokens survive
  s = s
    .replace(/["'`׳״]/g, '')
    .replace(/[^\p{L}\p{N}%\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // Strip stopwords
  const tokens = s.split(' ').filter((t) => t && !STOPWORDS.has(t));

  return tokens.join(' ');
};

/**
 * Tokenize a normalized string into meaningful tokens.
 * Filters out single-char tokens (except digits and digit+%).
 */
export const tokenize = (normalized: string): string[] =>
  normalized
    .split(' ')
    .filter((t) => t.length >= 2 || /^\d+%?$/.test(t));
