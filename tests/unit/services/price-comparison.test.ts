import { PriceComparisonService } from '../../../src/services/price-comparison.service';
import type { ShoppingListRepository } from '../../../src/repositories/shopping-list.repository';
import type { ChainProductRepository } from '../../../src/repositories/chain-product.repository';
import type { ShoppingItem } from '../../../src/models/shopping-list.model';
import type { ChainProduct, ChainId } from '../../../src/models/chain-product.model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date();

function fakeChainProduct(overrides: Partial<ChainProduct> = {}): ChainProduct {
  return {
    id: 'cp-1',
    chainId: 'shufersal' as ChainId,
    externalId: 'ext-1',
    originalName: 'Test Product',
    normalizedName: 'test product',
    price: 10,
    isActive: true,
    lastSeenAt: NOW,
    promotions: [],
    hasActivePromotions: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function fakeShoppingItem(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    category: 'other',
    quantity: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}


function buildService(options: {
  shoppingListItems?: ShoppingItem[];
  chainProductsByProductId?: ChainProduct[];
  chainProductsByBarcode?: ChainProduct[];
  chainProductsByName?: ChainProduct[];
  chainProductsByExternalId?: ChainProduct | null;
  chainProductsByProduceAliases?: ChainProduct[];
  chainProductsByNormalizedNames?: ChainProduct[];
}) {
  const shoppingListRepo = {
    getOrCreateActiveList: jest.fn().mockResolvedValue({
      id: 'list-1',
      userId: 'user-1',
      name: 'Active',
      status: 'active',
      defaultCategoryOrder: [],
      items: options.shoppingListItems ?? [],
      createdAt: NOW,
      updatedAt: NOW,
    }),
  } as unknown as ShoppingListRepository;

  const chainProductRepo = {
    findByProductId: jest.fn().mockResolvedValue(options.chainProductsByProductId ?? []),
    findByBarcode: jest.fn().mockResolvedValue(options.chainProductsByBarcode ?? []),
    findCandidatesByName: jest.fn().mockResolvedValue(options.chainProductsByName ?? []),
    findByExternalId: jest.fn().mockResolvedValue(options.chainProductsByExternalId ?? null),
    findByProduceAliases: jest.fn().mockResolvedValue(options.chainProductsByProduceAliases ?? []),
    findByNormalizedNames: jest.fn().mockResolvedValue(options.chainProductsByNormalizedNames ?? []),
    debugFindByTokens: jest.fn().mockResolvedValue([]),
  } as unknown as ChainProductRepository;

  const service = new PriceComparisonService(shoppingListRepo, chainProductRepo);

  return { service, shoppingListRepo, chainProductRepo };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PriceComparisonService — match priority', () => {
  describe('priority 1: productId', () => {
    it('matches by productId when present', async () => {
      const cp = fakeChainProduct({ id: 'cp-pid', price: 5 });
      const { service, chainProductRepo } = buildService({
        shoppingListItems: [fakeShoppingItem({ productId: 'prod-1' })],
        chainProductsByProductId: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const matched = result.chains[0].matchedItems;

      expect(matched).toHaveLength(1);
      expect(matched[0].matchSource).toBe('product_id');
      expect(matched[0].product.id).toBe('cp-pid');
      // Should not fall through to barcode or name
      expect(chainProductRepo.findByBarcode).not.toHaveBeenCalled();
      expect(chainProductRepo.findCandidatesByName).not.toHaveBeenCalled();
    });
  });

  describe('priority 2: barcode', () => {
    it('matches by barcode when no productId', async () => {
      const cp = fakeChainProduct({ id: 'cp-bc', barcode: '7290001234567', price: 8 });
      const { service, chainProductRepo } = buildService({
        shoppingListItems: [fakeShoppingItem({ barcode: '7290001234567' })],
        chainProductsByBarcode: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const matched = result.chains[0].matchedItems;

      expect(matched).toHaveLength(1);
      expect(matched[0].matchSource).toBe('barcode');
      expect(chainProductRepo.findByProductId).not.toHaveBeenCalled();
    });
  });

  describe('priority 3: produce catalog', () => {
    it('returns unmatched for produce when canonicalKey is not in exact map', async () => {
      // 'אשכולית' (grapefruit) is in the produce catalog but not in PRODUCE_CHAIN_EXACT_MAP
      // → matchByProduce returns null immediately, no DB call.
      const { service, chainProductRepo } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'אשכולית' })],
      });

      const result = await service.compareActiveList('user-1');
      const chain = result.chains[0];

      expect(chain.matchedItems).toHaveLength(0);
      expect(chain.unmatchedItems).toHaveLength(1);
      expect(chainProductRepo.findByNormalizedNames).not.toHaveBeenCalled();
    });

    it('returns matched when canonicalKey is in exact map and DB name matches', async () => {
      // shufersal onion → allowed: ['בצל יבש']
      const cp = fakeChainProduct({
        id: 'cp-onion',
        originalName: 'בצל יבש',
        normalizedName: 'בצל יבש',
        price: 7,
      });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'בצל' })],
        chainProductsByNormalizedNames: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const matched = result.chains[0].matchedItems;

      expect(matched).toHaveLength(1);
      expect(matched[0].matchSource).toBe('produce');
      expect(matched[0].product.id).toBe('cp-onion');
    });
  });

  describe('priority 5: name fallback', () => {
    it('matches by name scoring when no other identifiers', async () => {
      const cp = fakeChainProduct({
        id: 'cp-name',
        originalName: 'שקית ניילון גדולה',
        normalizedName: 'שקית ניילון גדולה',
        price: 3,
      });
      const { service } = buildService({
        shoppingListItems: [
          fakeShoppingItem({ name: 'שקית ניילון', rawName: 'שקית ניילון' }),
        ],
        chainProductsByName: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const matched = result.chains[0].matchedItems;

      expect(matched).toHaveLength(1);
      expect(matched[0].matchSource).toBe('name');
    });
  });

  describe('produce exact map — false positive prevention', () => {
    // DB returns a product whose normalizedName contains the produce word but is NOT
    // in the whitelist (wrong category: cosmetic / candy / processed).
    // The whitelist filter must reject it → unmatched.

    it('cucumber: DB returns face-cream product → unmatched (not in whitelist)', async () => {
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'מלפפון' })],
        chainProductsByNormalizedNames: [
          fakeChainProduct({ originalName: 'קרם פנים מלפפון', normalizedName: 'קרם פנים מלפפון' }),
        ],
      });

      const result = await service.compareActiveList('user-1');

      expect(result.chains[0].matchedItems).toHaveLength(0);
      expect(result.chains[0].unmatchedItems).toHaveLength(1);
    });

    it('lemon: DB returns candy product → unmatched (not in whitelist)', async () => {
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'לימון' })],
        chainProductsByNormalizedNames: [
          fakeChainProduct({ originalName: 'סוכריות לימון', normalizedName: 'סוכריות לימון' }),
        ],
      });

      const result = await service.compareActiveList('user-1');

      expect(result.chains[0].matchedItems).toHaveLength(0);
      expect(result.chains[0].unmatchedItems).toHaveLength(1);
    });

    it('tomato: DB returns tomato paste product → unmatched (not in whitelist)', async () => {
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'עגבניות' })],
        chainProductsByNormalizedNames: [
          fakeChainProduct({ originalName: 'רסק עגבניות', normalizedName: 'רסק עגבניות' }),
        ],
      });

      const result = await service.compareActiveList('user-1');

      expect(result.chains[0].matchedItems).toHaveLength(0);
      expect(result.chains[0].unmatchedItems).toHaveLength(1);
    });
  });

  describe('Shufersal fruit exact mapping', () => {
    it('AC2: apple has no Shufersal exact map entry → unmatched', async () => {
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'תפוח' })],
        chainProductsByNormalizedNames: [
          fakeChainProduct({ originalName: 'תפוח עץ', normalizedName: 'תפוח עץ' }),
        ],
      });

      const result = await service.compareActiveList('user-1');
      const shufersal = result.chains.find((c) => c.chainId === 'shufersal')!;

      expect(shufersal.matchedItems).toHaveLength(0);
      expect(shufersal.unmatchedItems).toHaveLength(1);
    });

    it('AC3: "קיווי" matches Shufersal "מארז קיווי ירוק"', async () => {
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'קיווי' })],
        chainProductsByNormalizedNames: [
          fakeChainProduct({ originalName: 'מארז קיווי ירוק', normalizedName: 'מארז קיווי ירוק', isWeighted: true }),
        ],
      });

      const result = await service.compareActiveList('user-1');
      const shufersal = result.chains.find((c) => c.chainId === 'shufersal')!;

      expect(shufersal.matchedItems).toHaveLength(1);
      expect(shufersal.matchedItems[0].matchSource).toBe('produce');
    });

    it('AC4: "נקטרינה" matches Shufersal "נקטרינה ארוז"', async () => {
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'נקטרינה' })],
        chainProductsByNormalizedNames: [
          fakeChainProduct({ originalName: 'נקטרינה ארוז', normalizedName: 'נקטרינה ארוז', isWeighted: true }),
        ],
      });

      const result = await service.compareActiveList('user-1');
      const shufersal = result.chains.find((c) => c.chainId === 'shufersal')!;

      expect(shufersal.matchedItems).toHaveLength(1);
      expect(shufersal.matchedItems[0].matchSource).toBe('produce');
    });

    it('AC5+6: "אננס" with unit=KG matches "אננס טרי יחידה"; itemUnit=UNIT, pricingAccuracy=accurate', async () => {
      // MVP: KG quantity reinterpreted as unit count; 2 kg → 2 units of pineapple
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'אננס', quantity: 2, unit: 'KG' })],
        chainProductsByNormalizedNames: [
          fakeChainProduct({ originalName: 'אננס טרי יחידה', normalizedName: 'אננס טרי יחידה', isWeighted: false, price: 10 }),
        ],
      });

      const result = await service.compareActiveList('user-1');
      const shufersal = result.chains.find((c) => c.chainId === 'shufersal')!;
      const matched = shufersal.matchedItems[0];

      expect(matched.matchSource).toBe('produce');
      expect(matched.itemUnit).toBe('UNIT');
      expect(matched.pricingAccuracy).toBe('accurate');
      expect(matched.effectiveTotalPrice).toBeCloseTo(20);
    });
  });

  describe('unmatched items', () => {
    it('reports items that match nothing', async () => {
      const { service } = buildService({
        shoppingListItems: [
          fakeShoppingItem({ name: 'מוצר מסתורי', rawName: 'מוצר מסתורי' }),
        ],
      });

      const result = await service.compareActiveList('user-1');
      const unmatched = result.chains[0].unmatchedItems;

      expect(unmatched).toHaveLength(1);
      expect(unmatched[0].shoppingItemName).toBe('מוצר מסתורי');
    });
  });

  describe('strict barcode matching', () => {
    it('barcode item found in all chains → matched in all', async () => {
      const cp = fakeChainProduct({ id: 'cp-bc', barcode: '7290001234567', price: 10 });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ barcode: '7290001234567' })],
        chainProductsByBarcode: [cp],
      });

      const result = await service.compareActiveList('user-1');

      // All 3 chains use the same mock, so all should match by barcode
      for (const chain of result.chains) {
        expect(chain.matchedItems).toHaveLength(1);
        expect(chain.matchedItems[0].matchSource).toBe('barcode');
        expect(chain.unmatchedItems).toHaveLength(0);
      }
    });

    it('barcode item missing in a chain → unmatched, no name fallback', async () => {
      const cp = fakeChainProduct({ id: 'cp-bc', barcode: '7290001234567', price: 10 });
      const similarByName = fakeChainProduct({
        id: 'cp-name-similar',
        originalName: 'חלב תנובה 1%',
        normalizedName: 'חלב תנובה 1%',
        price: 8,
      });

      // Return barcode match only for shufersal, empty for others
      const chainProductRepo = {
        findByProductId: jest.fn().mockResolvedValue([]),
        findByBarcode: jest.fn().mockImplementation((_barcode: string, chainId: ChainId) => {
          if (chainId === 'shufersal') return Promise.resolve([cp]);
          return Promise.resolve([]);
        }),
        findCandidatesByName: jest.fn().mockResolvedValue([similarByName]),
        findByExternalId: jest.fn().mockResolvedValue(null),
      } as unknown as ChainProductRepository;

      const shoppingListRepo = {
        getOrCreateActiveList: jest.fn().mockResolvedValue({
          id: 'list-1',
          userId: 'user-1',
          name: 'Active',
          status: 'active',
          defaultCategoryOrder: [],
          items: [fakeShoppingItem({ name: 'חלב תנובה 3%', barcode: '7290001234567' })],
          createdAt: NOW,
          updatedAt: NOW,
        }),
      } as unknown as ShoppingListRepository;

      const service = new PriceComparisonService(shoppingListRepo, chainProductRepo);
      const result = await service.compareActiveList('user-1');

      // Shufersal: matched by barcode
      const shufersal = result.chains.find((c) => c.chainId === 'shufersal')!;
      expect(shufersal.matchedItems).toHaveLength(1);
      expect(shufersal.matchedItems[0].matchSource).toBe('barcode');

      // Other chains: unmatched — must NOT fall back to name matching
      const ramiLevy = result.chains.find((c) => c.chainId === 'rami-levy')!;
      expect(ramiLevy.matchedItems).toHaveLength(0);
      expect(ramiLevy.unmatchedItems).toHaveLength(1);

      const machsanei = result.chains.find((c) => c.chainId === 'machsanei-hashuk')!;
      expect(machsanei.matchedItems).toHaveLength(0);
      expect(machsanei.unmatchedItems).toHaveLength(1);

      // Name matching should never be called for a barcode item
      expect(chainProductRepo.findCandidatesByName).not.toHaveBeenCalled();
    });

    it('no-barcode item still uses name matching', async () => {
      const cp = fakeChainProduct({
        id: 'cp-name',
        originalName: 'שקית ניילון גדולה',
        normalizedName: 'שקית ניילון גדולה',
        price: 3,
      });
      const { service, chainProductRepo } = buildService({
        shoppingListItems: [
          fakeShoppingItem({ name: 'שקית ניילון', rawName: 'שקית ניילון' }),
        ],
        chainProductsByName: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const matched = result.chains[0].matchedItems;

      expect(matched).toHaveLength(1);
      expect(matched[0].matchSource).toBe('name');
      expect(chainProductRepo.findCandidatesByName).toHaveBeenCalled();
    });

    it('totalPrice excludes unmatched barcode items', async () => {
      const matchedCp = fakeChainProduct({ id: 'cp-1', barcode: '1111', price: 15 });
      const otherCp = fakeChainProduct({
        id: 'cp-name',
        originalName: 'שקית ניילון',
        normalizedName: 'שקית ניילון',
        price: 99,
      });

      const chainProductRepo = {
        findByProductId: jest.fn().mockResolvedValue([]),
        findByBarcode: jest.fn().mockImplementation((barcode: string) => {
          if (barcode === '1111') return Promise.resolve([matchedCp]);
          return Promise.resolve([]);
        }),
        findCandidatesByName: jest.fn().mockResolvedValue([otherCp]),
        findByExternalId: jest.fn().mockResolvedValue(null),
      } as unknown as ChainProductRepository;

      const shoppingListRepo = {
        getOrCreateActiveList: jest.fn().mockResolvedValue({
          id: 'list-1',
          userId: 'user-1',
          name: 'Active',
          status: 'active',
          defaultCategoryOrder: [],
          items: [
            fakeShoppingItem({ id: 'i1', name: 'Item A', barcode: '1111', quantity: 1 }),
            fakeShoppingItem({ id: 'i2', name: 'Item B', barcode: '9999', quantity: 1 }),
          ],
          createdAt: NOW,
          updatedAt: NOW,
        }),
      } as unknown as ShoppingListRepository;

      const service = new PriceComparisonService(shoppingListRepo, chainProductRepo);
      const result = await service.compareActiveList('user-1');

      for (const chain of result.chains) {
        // Only item A (barcode 1111) is matched; item B (barcode 9999) is unmatched
        expect(chain.matchedItems).toHaveLength(1);
        expect(chain.unmatchedItems).toHaveLength(1);
        // totalPrice should only include matched item (price=15), not the 99-priced name match
        expect(chain.totalPrice).toBe(15);
      }
    });
  });

  describe('pepper ambiguity — bare פלפל is unmatched', () => {
    it('פלפל alone does not match any produce entry', async () => {
      const { service, chainProductRepo } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'פלפל' })],
      });

      const result = await service.compareActiveList('user-1');
      const chain = result.chains[0];

      // 'פלפל' is no longer an alias of pepper-green; matchProduceCanonical returns null.
      // Without a produce match it falls through to name matching (no productId/barcode).
      // findCandidatesByName may be called, but the item should end up unmatched or at most
      // matched by name — the important thing is it does NOT incorrectly match as pepper-green.
      expect(chain.unmatchedItems.some((i) => i.shoppingItemName === 'פלפל')).toBe(true);
      expect(chainProductRepo.findByNormalizedNames).not.toHaveBeenCalled();
    });

    it('פלפל ירוק still matches pepper-green produce entry', async () => {
      // tiv-taam maps pepper-green → 'פלפל ירוק'; check that chain specifically.
      const cp = fakeChainProduct({
        id: 'cp-pepper-green',
        originalName: 'פלפל ירוק',
        normalizedName: 'פלפל ירוק',
        price: 5,
      });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'פלפל ירוק' })],
        chainProductsByNormalizedNames: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const tivTaam = result.chains.find((c) => c.chainId === 'tiv-taam')!;
      const matched = tivTaam.matchedItems;

      expect(matched).toHaveLength(1);
      expect(matched[0].matchSource).toBe('produce');
      expect(matched[0].product.id).toBe('cp-pepper-green');
    });

    it('פלפל אדום still matches pepper-red produce entry', async () => {
      const cp = fakeChainProduct({
        id: 'cp-pepper-red',
        originalName: 'פלפל אדום',
        normalizedName: 'פלפל אדום',
        price: 6,
      });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'פלפל אדום' })],
        chainProductsByNormalizedNames: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const matched = result.chains[0].matchedItems;

      expect(matched).toHaveLength(1);
      expect(matched[0].matchSource).toBe('produce');
      expect(matched[0].product.id).toBe('cp-pepper-red');
    });
  });

  describe('produce matching — exact map only', () => {
    // אשכולית / תפוח are in the produce catalog but NOT in PRODUCE_CHAIN_EXACT_MAP.
    // matchByProduce must return null immediately — no DB call, no fuzzy fallback.

    it('produce item with no map entry is always unmatched (אשכולית)', async () => {
      const { service, chainProductRepo } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'אשכולית' })],
      });
      const chain = (await service.compareActiveList('user-1')).chains[0];
      expect(chain.matchedItems).toHaveLength(0);
      expect(chain.unmatchedItems).toHaveLength(1);
      expect(chainProductRepo.findByNormalizedNames).not.toHaveBeenCalled();
    });

    it('produce item with map entry for one chain but no DB match → unmatched (בננה)', async () => {
      // banana has a shufersal entry now; DB returns nothing → still unmatched.
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'בננה' })],
      });
      const chain = (await service.compareActiveList('user-1')).chains[0];
      expect(chain.matchedItems).toHaveLength(0);
      expect(chain.unmatchedItems).toHaveLength(1);
    });

    it('produce item with no map entry is always unmatched (תפוח)', async () => {
      const { service, chainProductRepo } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'תפוח' })],
      });
      const chain = (await service.compareActiveList('user-1')).chains[0];
      expect(chain.matchedItems).toHaveLength(0);
      expect(chain.unmatchedItems).toHaveLength(1);
      expect(chainProductRepo.findByNormalizedNames).not.toHaveBeenCalled();
    });

    it('produce item in map but DB returns no match → unmatched (לימון, empty DB)', async () => {
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'לימון' })],
        // chainProductsByNormalizedNames defaults to [] → no match in DB
      });
      const chain = (await service.compareActiveList('user-1')).chains[0];
      expect(chain.matchedItems).toHaveLength(0);
      expect(chain.unmatchedItems).toHaveLength(1);
    });
  });

  describe('Rami Levy fruit exact mapping', () => {
    it('"אגסים" matches Rami Levy "אגס"', async () => {
      const cp = fakeChainProduct({
        id: 'cp-pear-rl',
        chainId: 'rami-levy' as ChainId,
        originalName: 'אגס',
        normalizedName: 'אגס',
        isWeighted: true,
        price: 9,
      });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'אגסים' })],
        chainProductsByNormalizedNames: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const ramiLevy = result.chains.find((c) => c.chainId === 'rami-levy')!;

      expect(ramiLevy.matchedItems).toHaveLength(1);
      expect(ramiLevy.matchedItems[0].matchSource).toBe('produce');
      expect(ramiLevy.matchedItems[0].product.id).toBe('cp-pear-rl');
    });

    it('"אננס" matches Rami Levy "אננס מובחר"', async () => {
      const cp = fakeChainProduct({
        id: 'cp-pineapple-rl',
        chainId: 'rami-levy' as ChainId,
        originalName: 'אננס מובחר',
        normalizedName: 'אננס מובחר',
        isWeighted: false,
        price: 15,
      });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'אננס' })],
        chainProductsByNormalizedNames: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const ramiLevy = result.chains.find((c) => c.chainId === 'rami-levy')!;

      expect(ramiLevy.matchedItems).toHaveLength(1);
      expect(ramiLevy.matchedItems[0].matchSource).toBe('produce');
      expect(ramiLevy.matchedItems[0].product.id).toBe('cp-pineapple-rl');
    });

    it('"ענבים" matches Rami Levy "ענבים ירוקים"', async () => {
      const cp = fakeChainProduct({
        id: 'cp-grapes-rl',
        chainId: 'rami-levy' as ChainId,
        originalName: 'ענבים ירוקים',
        normalizedName: 'ענבים ירוקים',
        isWeighted: true,
        price: 20,
      });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'ענבים' })],
        chainProductsByNormalizedNames: [cp],
      });

      const result = await service.compareActiveList('user-1');
      const ramiLevy = result.chains.find((c) => c.chainId === 'rami-levy')!;

      expect(ramiLevy.matchedItems).toHaveLength(1);
      expect(ramiLevy.matchedItems[0].matchSource).toBe('produce');
      expect(ramiLevy.matchedItems[0].product.id).toBe('cp-grapes-rl');
    });
  });

  describe('cheapest chain selection', () => {
    it('picks the chain with lowest total', async () => {
      const cp = fakeChainProduct({ price: 5 });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ productId: 'prod-1', quantity: 2 })],
        chainProductsByProductId: [cp],
      });

      const result = await service.compareActiveList('user-1');

      // All 3 chains get the same mock data, so all have equal total
      expect(result.cheapestChainId).not.toBeNull();
    });

    it('returns null cheapestChainId when no items match', async () => {
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'מוצר מסתורי' })],
      });

      const result = await service.compareActiveList('user-1');

      expect(result.cheapestChainId).toBeNull();
    });

    it('returns null when all chains have at least one unmatched item', async () => {
      const cp = fakeChainProduct({ price: 5 });
      const { service } = buildService({
        shoppingListItems: [
          fakeShoppingItem({ id: 'item-1', productId: 'prod-1', quantity: 1 }),
          fakeShoppingItem({ id: 'item-2', name: 'פריט לא קיים' }),
        ],
        chainProductsByProductId: [cp],
      });

      const result = await service.compareActiveList('user-1');

      expect(result.cheapestChainId).toBeNull();
    });

    it('marks chain as not comparable when it has unmatched items', async () => {
      const cp = fakeChainProduct({ price: 5 });
      const { service } = buildService({
        shoppingListItems: [
          fakeShoppingItem({ id: 'item-1', productId: 'prod-1', quantity: 1 }),
          fakeShoppingItem({ id: 'item-2', name: 'פריט לא קיים' }),
        ],
        chainProductsByProductId: [cp],
      });

      const result = await service.compareActiveList('user-1');

      for (const chain of result.chains) {
        expect(chain.isComparable).toBe(false);
        expect(chain.unmatchedItems).toHaveLength(1);
      }
    });

    it('marks chain as comparable only when all items are matched', async () => {
      const cp = fakeChainProduct({ price: 5 });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ productId: 'prod-1', quantity: 1 })],
        chainProductsByProductId: [cp],
      });

      const result = await service.compareActiveList('user-1');

      for (const chain of result.chains) {
        expect(chain.isComparable).toBe(true);
        expect(chain.unmatchedItems).toHaveLength(0);
      }
    });
  });
});
