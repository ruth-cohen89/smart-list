/**
 * Lightweight test harness for the receipt line parser.
 * No framework required — run with:  npx ts-node tests/receipt-parser.harness.ts
 */

import { parseItems, postProcessItems } from '../src/services/receipt.service';

interface Case {
  input: string;
  expectItems: boolean;          // true = at least one item expected
  postProcess?: boolean;         // also run postProcessItems (uses input as rawText)
  expectedName?: string;         // exact first-item name
  expectedNameStartsWith?: string; // first-item name prefix
  expectedItemCount?: number;    // exact result count
  expectedQty?: number;
  expectedPrice?: number;
}

const cases: Case[] = [
  // --- previous cases ---
  { input: 'HAVE A NICE DAY',                expectItems: false },
  { input: 'THANK YOU',                      expectItems: false },
  { input: 'TOTAL 52.90',                    expectItems: false },
  { input: 'מלפפון 2.90',                    expectItems: true,  expectedName: 'מלפפון',          expectedPrice: 2.90 },
  { input: 'BREAD 7.50',                     expectItems: true,  expectedName: 'BREAD',            expectedPrice: 7.50 },
  { input: 'שוקו x2 5.00',                   expectItems: true,  expectedName: 'שוקו', expectedQty: 2, expectedPrice: 5.00 },

  // --- real-receipt cases ---
  { input: 'שניצל עוף פרימיום 34.37',        expectItems: true,  expectedName: 'שניצל עוף פרימיום', expectedPrice: 34.37 },
  { input: 'כ. אשראי 45.02',                expectItems: false },  // credit stopword
  { input: 'סה"כ 48.02',                    expectItems: false },  // total stopword
  { input: 'TOTAL 48.02',                    expectItems: false },  // English total
  { input: '****1234',                       expectItems: false },  // masked card
  { input: '30/12/2025',                     expectItems: false },  // date pattern
  { input: 'תודה שקנית',                    expectItems: false },  // no numeric signal

  // --- Hebrew RTL layout cases ---
  { input: 'mw 12.90 ביצים',                expectItems: true,  expectedName: 'ביצים',   expectedPrice: 12.90 },
  { input: '₪ 24.90 שמן זית',              expectItems: true,  expectedName: 'שמן זית', expectedPrice: 24.90 },
  { input: '0 ₪ סה"כ ביניים',              expectItems: false },  // zero + stopword
  { input: 'תשלום מזזמז 60.00',             expectItems: false },  // payment stopword
  { input: 'Apples 2.49',                    expectItems: true,  expectedName: 'Apples',   expectedPrice: 2.49 },

  // --- hardening cases ---
  { input: 'Simin): mw 57.25',              expectItems: false },  // junk chars in cleaned name
  { input: 'wm 2.75 עהיף',                 expectItems: false },  // עהיף (change) stopword

  // --- new price format cases (Google Vision output) ---
  // Note: "חלב" / "לחם" (3-char names) are intentionally rejected by looksLikeRealName (length < 4).
  { input: 'חלב 12.9',                     expectItems: false },
  { input: 'לחם 5,9',                      expectItems: false },
  { input: 'ביצים 12.90₪',                 expectItems: true,  expectedName: 'ביצים', expectedPrice: 12.90 },  // trailing ₪

  // --- leading ₪ price priority (digital receipts) ---
  // Line format: "₪<total>  <unit_price> ליח'  <name>  <weight> ק"ג"
  // The trailing weight must NOT be picked as the price.
  {
    input: '₪1.12 8.90 ליח\' פלפל חריף 0.13 ק"ג',
    expectItems: true,
    expectedPrice: 1.12,
  },
  {
    input: '₪18.90 18.90 ליח\' עיגולי ביסקוויט 39.90',
    expectItems: true,
    expectedPrice: 18.90,
  },

  // --- photo receipt: high-digitRatio lines (item codes embedded in raw line) ---
  // digitRatio on raw line would exceed 0.55 and block this; we now check cleaned name only.
  { input: 'שניצל עוף 9876543210 34.37', expectItems: true, expectedName: 'שניצל עוף', expectedPrice: 34.37 },

  // --- photo receipt: price × weight — finalPrice = unitPrice × weightKg ---
  // extractMultiplyLine computes 56.90 * 0.604 = 34.37; weight stored as quantity.
  { input: 'בקר טחון 56.90 * 0.604', expectItems: true, expectedName: 'בקר טחון', expectedPrice: 34.37, expectedQty: 0.604 },

  // --- post-processing: meta / payment lines must not become items ---
  { input: 'לתשלום 45.02',                 postProcess: true, expectItems: false },
  { input: 'אמצעי אשראי 45.02',            postProcess: true, expectItems: false },
  { input: 'סהכ 48.02',                    postProcess: true, expectItems: false },
  { input: 'רגיל 45.02',                   postProcess: true, expectItems: false },

  // --- PDF noise guards ---

  // Page separator resets nameBuffer: items from page 1 and page 2 are both returned
  // but their names never merge (page 1 name must not contaminate page 2 item).
  {
    input: 'חציל 7.90\n\n--- PAGE 2 ---\n\nגמבה 4.50',
    expectItems: true,
    expectedItemCount: 2,
    expectedPrice: 7.90,  // first item is "חציל 7.90"
  },

  // Totals section hard-stop: "לתשלום" breaks the loop; "חלב גדול" after it is NOT emitted.
  {
    input: 'ביצים 12.90\nלתשלום 60.00\nחלב גדול 14.50',
    expectItems: true,
    expectedItemCount: 1,  // only ביצים, not חלב גדול
    expectedName: 'ביצים',
  },

  // Long-line guard: lines > 120 chars are legal/marketing text, not item lines.
  {
    input: 'המוצרים בחנות זו עברו בדיקת איכות קפדנית ואנו מבטיחים שביעות רצון מלאה ללקוחות שלנו תמיד וכל הזמן 12.90',
    expectItems: false,
  },

  // --- post-processing: DIGITAL-only rules ---
  // "לק ג" prefix item must be merged into the next item's name.
  {
    input: '7290011011139\n7290011011146\n7290011011153\n24.90\n39.90\nלק ג\nחזה שלם טרי מהדרין',
    postProcess: true, expectItems: true,
    expectedNameStartsWith: 'לק ג',
  },
  // Deposit (פיקדון, price ≤ 1.5) must be dropped; real item survives.
  {
    input: '7290011011139\n7290011011146\n7290011011153\n0.30\n6.90\nפיקדון\nביצים',
    postProcess: true, expectItems: true,
    expectedItemCount: 1, expectedName: 'ביצים',
  },
  // Promo fragment (מבצע, price ≤ 6) must be dropped; real item survives.
  {
    input: '7290011011139\n7290011011146\n7290011011153\n1.00\n6.90\nמבצע חוסכים\nביצים',
    postProcess: true, expectItems: true,
    expectedItemCount: 1, expectedName: 'ביצים',
  },

  // --- D: discount extraction and application ---
  // Leading-minus discount line applied to previous item.
  { input: 'ביצים 12.90\n-2.00',      expectItems: true, expectedName: 'ביצים',  expectedPrice: 10.90 },
  // Trailing-minus discount line applied to previous item.
  { input: 'לחם קל 7.50\n2.00-',      expectItems: true, expectedName: 'לחם קל', expectedPrice: 5.50 },
  // Discount line WITH a Hebrew stopword label → hasStopword catches it first; price is unchanged.
  { input: 'מלפפון 3.90\nהנחה -1.00', expectItems: true, expectedName: 'מלפפון', expectedPrice: 3.90 },

  // --- F: quantity × unit price multipliers ---
  // Name on previous line; qty × price on this line — finalPrice = 2 × 3.90 = 7.80.
  { input: 'מיץ תפוח\n2 × 3.90', expectItems: true, expectedName: 'מיץ תפוח', expectedPrice: 7.80, expectedQty: 2 },
  // Qty on same line as name — 3 × 4.50 = 13.50.
  { input: 'שוקו 3 × 4.50',      expectItems: true, expectedName: 'שוקו',    expectedPrice: 13.50, expectedQty: 3 },

  // --- Failure A: discount line with Hebrew prefix text (trailing minus) ---
  // "*ק/..." prefix must not prevent the discount from being applied to the previous item.
  { input: 'אצבעות שוקולד חלב 4.90\n*ק/אצבעות שוקול 2.00-',
    expectItems: true, expectedName: 'אצבעות שוקולד חלב', expectedPrice: 2.90 },

  // --- Failure B: company name header (בע"מ) must not become an item ---
  // isMetaLine catches "בעמ" (normalised "בע\"מ") — only the real item after it is returned.
  { input: '1.2.מחסני השוק בע"מ\nמלפפון 3.90',
    expectItems: true, expectedName: 'מלפפון', expectedItemCount: 1 },

  // --- Failure C: digital block receipt — promo excluded, qty inferred ---
  // ₪13.20 / 6.60 = 2 → quantity=2; promo line "מבצע" is excluded from name.
  { input: '₪13.20\n6.60\nליח\'\nחומוס גרגירים שלם\n7290120860155\nמבצע 2ב12 ₪ -1.20',
    expectItems: true, expectedName: 'חומוס גרגירים שלם', expectedPrice: 13.20, expectedQty: 2 },

  // --- H4: weight item — name on line 1, multiply on line 2, final price on line 3 ---
  // extractMultiplyLine fires on line 2 → pushItem(34.37, qty=0.604); line 3 has empty buffer.
  { input: 'שרי עגבניות\n56.90 * 0.604\n34.37',
    expectItems: true, expectedName: 'שרי עגבניות', expectedPrice: 34.37, expectedQty: 0.604 },

  // --- Regression: unit-price lines also start with ₪ (Rami Levi format) ---
  // ₪3.90 is unit price; ₪13.20 is total (MAX wins); barcode anchors the block.
  { input: '₪13.20\n6.60\nליח\'\n₪3.90\n3.90\nחומוס גרגירים שלם 30\n7290120860155',
    expectItems: true, expectedName: 'חומוס גרגירים שלם', expectedPrice: 13.20, expectedQty: 2 },

  // --- Double-₪ OCR artifact normalization: "₪₪7.80" → ₪7.80 = totalPrice ---
  { input: '₪₪7.80\n3.90\nביצים טריות\n7290000000123',
    expectItems: true, expectedName: 'ביצים טריות', expectedPrice: 7.80, expectedQty: 2 },

  // --- Segment-based: explicit qty=1 via standalone integer adjacent to ליח ---
  // cleanName strips bare numbers, so "55" is removed → "ציטוס פופס גר".
  { input: '₪3.90\n3.90\n1\nליח\'\nציטוס פופס 55 גר\n7290000000001',
    expectItems: true, expectedNameStartsWith: 'ציטוס פופס', expectedPrice: 3.90, expectedQty: 1 },

  // --- Segment-based: 4-item receipt — no cross-item price contamination ---
  // ציטוס פופס 55 גר (×1), ציטוס פופס 60 גרם (×2), דוריטוס שום עם טוויס (×4),
  // and promo lines that fall in the next item's segment are excluded.
  {
    input: [
      '₪13.20', '6.60', '2', "ליח'", 'חומוס גרגירים שלם', '7290120860155',
      'מבצע 2ב12 ₪ -1.20',
      '₪3.90', '3.90', '1', "ליח'", 'ציטוס פופס 55 גר', '7290000000001',
      '₪₪7.80', '3.90', '2', "ליח'", 'ציטוס פופס 60 גרם', '7290000000002',
      '₪15.60', '3.90', '4', "ליח'", 'דוריטוס שום עם טוויס', '7290000000003',
    ].join('\n'),
    expectItems: true, expectedItemCount: 4,
    expectedName: 'חומוס גרגירים שלם', expectedPrice: 13.20, expectedQty: 2,
  },

  // --- Missing-₪ fallback: no ₪-prefixed total in segment ---
  // totalPrice computed as round2(unitPrice × explicitQty) = round2(3.90 × 2) = 7.80.
  { input: '3.90\n2\nליח\'\nביצים טריות\n7290000000123',
    expectItems: true, expectedName: 'ביצים טריות', expectedPrice: 7.80, expectedQty: 2 },

  // --- Numeric backfill: unitPrice before a barcode-only segment (no name) ---
  // ליח' pushes kind to DIGITAL (score=3). First segment ['6.60', "ליח'"] has no Hebrew
  // name → skipped. Second segment ['ביצים טריות'] has no price → backfill recovers 6.60.
  { input: '6.60\nליח\'\n7290000000000\nביצים טריות\n7290000000123',
    expectItems: true, expectedName: 'ביצים טריות', expectedPrice: 6.60 },

  // --- Out-of-order OCR: numeric price lines for item 2 appear before item 1's barcode ---
  // Item 1 gets totalPrice=13.20 (MAX ₪ in segment), unitPrice=6.60, qty=2 (ratio).
  // Item 2's segment has no price → backfill recovers 3.90 from lines before barcode 1.
  {
    input: [
      '₪13.20', '6.60', "ליח'", '₪3.90', '3.90',
      'חומוס גרגירים שלם', '7290120860155',
      'ציטוס פופס 55 גר', '7290000000001',
    ].join('\n'),
    expectItems: true, expectedItemCount: 2,
    expectedName: 'חומוס גרגירים שלם', expectedPrice: 13.20, expectedQty: 2,
  },
];

let passed = 0;
let failed = 0;

for (const c of cases) {
  const parsed = parseItems(c.input);
  const items = c.postProcess ? postProcessItems(parsed, c.input) : parsed;
  const gotItems = items.length > 0;

  const errors: string[] = [];

  if (gotItems !== c.expectItems) {
    errors.push(`expected items=${c.expectItems}, got items=${gotItems}`);
  }

  if (c.expectedItemCount !== undefined && items.length !== c.expectedItemCount) {
    errors.push(`expected itemCount=${c.expectedItemCount}, got ${items.length}`);
  }

  if (c.expectItems && items[0]) {
    if (c.expectedName !== undefined && items[0].name !== c.expectedName) {
      errors.push(`expected name="${c.expectedName}", got "${items[0].name}"`);
    }
    if (c.expectedNameStartsWith !== undefined && !items[0].name.startsWith(c.expectedNameStartsWith)) {
      errors.push(`expected name to start with "${c.expectedNameStartsWith}", got "${items[0].name}"`);
    }
    if (c.expectedQty !== undefined && items[0].quantity !== c.expectedQty) {
      errors.push(`expected qty=${c.expectedQty}, got ${items[0].quantity}`);
    }
    if (c.expectedPrice !== undefined && items[0].price !== c.expectedPrice) {
      errors.push(`expected price=${c.expectedPrice}, got ${items[0].price}`);
    }
  }

  if (errors.length === 0) {
    console.log(`  PASS  "${c.input}"`);
    passed++;
  } else {
    console.error(`  FAIL  "${c.input}" → ${errors.join('; ')}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
