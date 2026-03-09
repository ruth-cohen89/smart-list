/**
 * Tests for the pure parsing/detection functions exported from receipt.service.ts.
 * No mocks needed — these functions are stateless.
 *
 * Note: RECEIPT_EXTRACT_PRICES env var is not set in the test environment,
 * so the parser runs in names-first mode (no price required to emit an item).
 * Only lines containing known product-hint words or multiply/weight patterns
 * are recognised as product lines in this mode.
 */
import {
  parseItems,
  detectReceiptKind,
  postProcessItems,
} from '../../../src/services/receipt.service';

// A realistic PHOTO/HYBRID receipt in names-first mode.
// Products contain words from PRODUCT_WORD_HINT_RE so they are picked up.
// The totals block triggers the strong-totals boundary and is never parsed.
const SAMPLE_RECEIPT = [
  'מחסנית - רשת שיווק', // store header  → skipped
  'תל אביב', // address line  → skipped
  'תאריך: 01/01/2024', // date line     → skipped
  'שוקולד עם חלב', // product (hint: שוקולד)
  'לחם שחור', // product (hint: לחם)
  'גבינה לבנה', // product (hint: גבינה)
  'סה"כ לתשלום', // totals boundary → parser stops here
  '50.00',
  'אשראי 50.00',
].join('\n');

describe('detectReceiptKind', () => {
  it('returns HYBRID for a plain receipt with no barcodes or multiply lines', () => {
    expect(detectReceiptKind(SAMPLE_RECEIPT)).toBe('HYBRID');
  });
});

describe('parseItems', () => {
  it('extracts product lines while ignoring the store header, date, and totals', () => {
    const items = parseItems(SAMPLE_RECEIPT);
    const names = items.map((i) => i.name);

    expect(names).toContain('שוקולד עם חלב');
    expect(names).toContain('לחם שחור');
    expect(names).toContain('גבינה לבנה');
  });

  it('does not include total or payment lines as items', () => {
    const items = parseItems(SAMPLE_RECEIPT);

    for (const item of items) {
      expect(item.name).not.toMatch(/סה"כ|לתשלום|אשראי|עודף/);
    }
  });

  it('returns an empty array when the text contains only totals / payment lines', () => {
    const totalsOnly = ['לתשלום 99.90', 'אשראי 99.90', 'עודף 0.00'].join('\n');
    expect(parseItems(totalsOnly)).toHaveLength(0);
  });
});

describe('postProcessItems', () => {
  it('filters out items whose names are financial meta-terms', () => {
    const dirtyItems = [
      { name: 'שוקולד מריר', normalizedName: 'שוקולד מריר' },
      { name: 'לתשלום', normalizedName: 'לתשלום' }, // payment keyword
    ];

    const result = postProcessItems(dirtyItems, SAMPLE_RECEIPT);
    const names = result.map((i) => i.name);

    expect(names).toContain('שוקולד מריר');
    expect(names).not.toContain('לתשלום');
  });
});
