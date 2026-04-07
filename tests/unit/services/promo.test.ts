import AdmZip from 'adm-zip';
import { gzipSync } from 'zlib';
import { computeBestEffectivePrice } from '../../../src/services/effective-price.service';
import { assignPromotionsToProducts } from '../../../src/services/promotion-merge.service';
import { parseRamiLevyPromotionFile } from '../../../src/infrastructure/catalog-import/rami-levy.promo.parser';
import { parseShufersalPromotionFile } from '../../../src/infrastructure/catalog-import/shufersal.promo.parser';
import { parseMahsaneiHashukPromotionFile } from '../../../src/infrastructure/catalog-import/mahsanei-hashuk.promo.parser';
import { PromotionKind, type NormalizedPromotion } from '../../../src/models/promotion.model';
import { parseDate, parsePromoDate, isPromotionActive, classifyPromotion } from '../../../src/utils/promo-utils';

function makePromotion(
  overrides: Partial<NormalizedPromotion> = {},
): NormalizedPromotion {
  return {
    chainId: 'shufersal',
    promotionId: 'PROMO-1',
    description: 'Promotion',
    startAt: null,
    endAt: null,
    discountRate: undefined,
    minQty: 2,
    maxQty: undefined,
    discountedPrice: 10,
    minItemsOffered: undefined,
    items: [{ itemCode: '123' }],
    parsedPromotionKind: PromotionKind.FIXED_PRICE_BUNDLE,
    rawPayload: {},
    ...overrides,
  };
}

describe('parseDate', () => {
  test('parses YYYY-MM-DD dates in Israel timezone', () => {
    const parsed = parseDate('2024-06-15', '10:30', 'start');
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.toISOString()).toBe('2024-06-15T07:30:00.000Z');
  });

  test('parses YYYY/MM/DD dates in Israel timezone', () => {
    const parsed = parseDate('2024/06/15', '23:59:59', 'end');
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.toISOString()).toBe('2024-06-15T20:59:59.000Z');
  });

  test('defaults missing start hour to start of day', () => {
    const parsed = parseDate('2024-01-01', undefined, 'start');
    expect(parsed?.toISOString()).toBe('2023-12-31T22:00:00.000Z');
  });

  test('defaults missing end hour to end of day', () => {
    const parsed = parseDate('2024-01-01', undefined, 'end');
    expect(parsed?.toISOString()).toBe('2024-01-01T21:59:59.000Z');
  });

  test('keeps parsePromoDate backward-compatible', () => {
    const parsed = parsePromoDate('2024-01-01', '12:00');
    expect(parsed).toEqual(parseDate('2024-01-01', '12:00', 'start'));
  });
});

describe('isPromotionActive', () => {
  const now = new Date('2024-06-15T12:00:00.000Z');

  test('returns true inside the active window', () => {
    expect(
      isPromotionActive(now, new Date('2024-06-01T00:00:00.000Z'), new Date('2024-06-30T00:00:00.000Z')),
    ).toBe(true);
  });

  test('returns false for expired promotions', () => {
    expect(isPromotionActive(now, null, new Date('2024-06-14T00:00:00.000Z'))).toBe(false);
  });
});

describe('classifyPromotion', () => {
  test('classifies fixed price bundles', () => {
    expect(classifyPromotion({ discountedPrice: 10, minQty: 2 })).toBe(
      PromotionKind.FIXED_PRICE_BUNDLE,
    );
  });

  test('classifies percent discounts', () => {
    expect(classifyPromotion({ discountRate: 20, discountType: 2 })).toBe(
      PromotionKind.PERCENT_DISCOUNT,
    );
  });

  test('classifies amount off discounts', () => {
    expect(classifyPromotion({ discountRate: 3, discountType: 1 })).toBe(
      PromotionKind.AMOUNT_OFF,
    );
  });

  test('returns unknown when classification is unclear', () => {
    expect(classifyPromotion({})).toBe(PromotionKind.UNKNOWN);
  });
});

describe('computeBestEffectivePrice', () => {
  const now = new Date('2024-06-15T12:00:00.000Z');
  const baseProduct = {
    price: 7,
    promotions: [] as NormalizedPromotion[],
  };

  test('falls back to the regular price with no promotions', () => {
    const result = computeBestEffectivePrice(baseProduct, 3, now);
    expect(result.effectiveTotalPrice).toBe(21);
    expect(result.appliedPromotion).toBeNull();
  });

  test('applies bundle pricing for 2-for-10', () => {
    const result = computeBestEffectivePrice(
      { price: 7, promotions: [makePromotion({ discountedPrice: 10, minQty: 2 })] },
      2,
      now,
    );

    expect(result.effectiveTotalPrice).toBe(10);
    expect(result.appliedPromotion?.promotionId).toBe('PROMO-1');
  });

  test('handles bundle remainders correctly', () => {
    const result = computeBestEffectivePrice(
      { price: 7, promotions: [makePromotion({ discountedPrice: 10, minQty: 2 })] },
      3,
      now,
    );

    expect(result.effectiveTotalPrice).toBe(17);
  });

  test('ignores expired promotions', () => {
    const result = computeBestEffectivePrice(
      {
        price: 7,
        promotions: [
          makePromotion({
            endAt: new Date('2024-01-01T00:00:00.000Z'),
          }),
        ],
      },
      2,
      now,
    );

    expect(result.effectiveTotalPrice).toBe(14);
    expect(result.appliedPromotion).toBeNull();
  });
});

describe('parseMahsaneiHashukPromotionFile', () => {
  test('groups Sale rows by PromotionID', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<Promos>
  <StoreID>97</StoreID>
  <Sales>
    <Sale>
      <PromotionID>100</PromotionID>
      <PromotionDescription>3 for 20</PromotionDescription>
      <PromotionStartDate>2024/06/01</PromotionStartDate>
      <PromotionEndDate>2024/06/30</PromotionEndDate>
      <ItemCode>111</ItemCode>
    </Sale>
    <Sale>
      <PromotionID>100</PromotionID>
      <PromotionDescription>3 for 20</PromotionDescription>
      <PromotionStartDate>2024/06/01</PromotionStartDate>
      <PromotionEndDate>2024/06/30</PromotionEndDate>
      <ItemCode>222</ItemCode>
    </Sale>
  </Sales>
</Promos>`;

    const parsed = parseMahsaneiHashukPromotionFile(Buffer.from(xml, 'utf-8'));
    expect(parsed.promotions).toHaveLength(1);
    expect(parsed.promotions[0].items.map((item) => item.itemCode)).toEqual(['111', '222']);
  });
});

describe('chain-specific promotion parsers', () => {
  test('parses Rami Levy promotions from Root > Promotions > Promotion', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<Root>
  <StoreId>39</StoreId>
  <Promotions>
    <Promotion>
      <PromotionId>999</PromotionId>
      <PromotionDescription>2 for 10</PromotionDescription>
      <PromotionStartDate>2024-06-01</PromotionStartDate>
      <PromotionEndDate>2024-06-30</PromotionEndDate>
      <MinQty>2</MinQty>
      <DiscountedPrice>10</DiscountedPrice>
      <PromotionItems>
        <Item><ItemCode>111</ItemCode></Item>
      </PromotionItems>
    </Promotion>
  </Promotions>
</Root>`;

    const parsed = parseRamiLevyPromotionFile(Buffer.from(xml, 'utf-8'));
    expect(parsed.storeId).toBe('39');
    expect(parsed.promotions).toHaveLength(1);
    expect(parsed.promotions[0].discountedPrice).toBe(10);
  });

  test('parses Shufersal promotions from root > Promotions > Promotion', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <StoreId>413</StoreId>
  <Promotions>
    <Promotion>
      <PromotionId>42</PromotionId>
      <PromotionDescription>10% off</PromotionDescription>
      <DiscountRate>10</DiscountRate>
      <PromotionItems>
        <Item><ItemCode>123</ItemCode></Item>
      </PromotionItems>
    </Promotion>
  </Promotions>
</root>`;

    const parsed = parseShufersalPromotionFile(Buffer.from(xml, 'utf-8'));
    expect(parsed.storeId).toBe('413');
    expect(parsed.promotions[0].discountRate).toBe(10);
  });
});

describe('archive extraction', () => {
  test('parses a ZIP buffer disguised as .gz for Rami Levy', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<Root>
  <StoreId>39</StoreId>
  <Promotions>
    <Promotion>
      <PromotionId>1</PromotionId>
      <PromotionDescription>zip test</PromotionDescription>
      <PromotionItems><Item><ItemCode>999</ItemCode></Item></PromotionItems>
    </Promotion>
  </Promotions>
</Root>`;

    const archive = new AdmZip();
    archive.addFile('PromoFull7290058140886-039-202406151200.xml', Buffer.from(xml, 'utf-8'));

    const parsed = parseRamiLevyPromotionFile(
      archive.toBuffer(),
      'PromoFull7290058140886-039-202406151200.gz',
    );

    expect(parsed.promotions[0].promotionId).toBe('1');
  });

  test('parses a gzip promotion file', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <StoreId>413</StoreId>
  <Promotions>
    <Promotion>
      <PromotionId>2</PromotionId>
      <PromotionDescription>gzip test</PromotionDescription>
      <PromotionItems><Item><ItemCode>888</ItemCode></Item></PromotionItems>
    </Promotion>
  </Promotions>
</root>`;

    const parsed = parseShufersalPromotionFile(
      gzipSync(Buffer.from(xml, 'utf-8')),
      'PromoFull7290873255550-413-202406151200.xml.gz',
    );

    expect(parsed.promotions[0].promotionId).toBe('2');
  });
});

describe('assignPromotionsToProducts', () => {
  test('matches only exact item codes against externalId or barcode', () => {
    const promotion = makePromotion({ items: [{ itemCode: '123' }] });
    const mergePlan = assignPromotionsToProducts(
      [
        { id: 'product-1', externalId: '123' },
        { id: 'product-2', externalId: '999', barcode: '123' },
        { id: 'product-3', externalId: '1234' },
      ],
      new Map([['123', [promotion]]]),
    );

    expect(mergePlan.assignments).toHaveLength(2);
    expect(mergePlan.assignments.map((assignment) => assignment.productId)).toEqual([
      'product-1',
      'product-2',
    ]);
    expect(mergePlan.unmatchedItemCodes).toEqual([]);
  });
});
