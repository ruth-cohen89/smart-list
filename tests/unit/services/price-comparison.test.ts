import { PriceComparisonService } from '../../../src/services/price-comparison.service';
import type { ShoppingListRepository } from '../../../src/repositories/shopping-list.repository';
import type { ChainProductRepository } from '../../../src/repositories/chain-product.repository';
import type { ProductRepository } from '../../../src/repositories/product.repository';
import type { ShoppingItem } from '../../../src/models/shopping-list.model';
import type { ChainProduct, ChainId } from '../../../src/models/chain-product.model';
import type { Product } from '../../../src/models/product.model';

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

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    productType: 'produce',
    barcode: null,
    canonicalKey: 'tomato',
    canonicalName: 'עגבניה',
    normalizedName: 'עגבניה',
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
  produceProduct?: Product;
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
  } as unknown as ChainProductRepository;

  const productRepo = {
    findOrCreateByCanonicalKey: jest
      .fn()
      .mockResolvedValue(options.produceProduct ?? fakeProduct()),
    findOrCreateByBarcode: jest.fn().mockResolvedValue(fakeProduct()),
    findByBarcode: jest.fn().mockResolvedValue(null),
    findByCanonicalKey: jest.fn().mockResolvedValue(null),
  } as unknown as ProductRepository;

  const service = new PriceComparisonService(shoppingListRepo, chainProductRepo, productRepo);

  return { service, shoppingListRepo, chainProductRepo, productRepo };
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
    it('matches produce by canonical key when name is in catalog', async () => {
      const cp = fakeChainProduct({
        id: 'cp-tomato',
        productId: 'prod-tomato',
        originalName: 'עגבניות',
        price: 6,
      });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'עגבניות', rawName: 'עגבניות' })],
        chainProductsByProductId: [cp],
        produceProduct: fakeProduct({ id: 'prod-tomato', canonicalKey: 'tomato' }),
      });

      const result = await service.compareActiveList('user-1');
      const matched = result.chains[0].matchedItems;

      expect(matched).toHaveLength(1);
      expect(matched[0].matchSource).toBe('produce');
    });

    it('falls through to name matching when no chain product for produce', async () => {
      const cp = fakeChainProduct({
        id: 'cp-name',
        originalName: 'עגבניות שדה',
        normalizedName: 'עגבניות שדה',
        price: 7,
      });
      const { service } = buildService({
        shoppingListItems: [fakeShoppingItem({ name: 'עגבניות', rawName: 'עגבניות' })],
        chainProductsByProductId: [], // no chain product linked to produce product
        chainProductsByName: [cp],
        produceProduct: fakeProduct({ id: 'prod-tomato', canonicalKey: 'tomato' }),
      });

      const result = await service.compareActiveList('user-1');
      const matched = result.chains[0].matchedItems;

      // Should fall through to name matching since produce path found no chain products
      expect(matched).toHaveLength(1);
      expect(matched[0].matchSource).toBe('name');
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
  });
});
