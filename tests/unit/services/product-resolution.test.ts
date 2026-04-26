import { ProductResolutionService } from '../../../src/services/product-resolution.service';
import type { ProductRepository } from '../../../src/repositories/product.repository';
import type { Product } from '../../../src/models/product.model';
import type { ParsedProduct } from '../../../src/infrastructure/catalog-import/price-file.parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-123',
    productType: 'packaged',
    barcode: null,
    canonicalKey: null,
    canonicalName: 'Test Product',
    normalizedName: 'test product',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockProductRepo(overrides: Partial<ProductRepository> = {}): ProductRepository {
  return {
    findByBarcode: jest.fn().mockResolvedValue(null),
    findByCanonicalKey: jest.fn().mockResolvedValue(null),
    createProduct: jest.fn().mockResolvedValue(fakeProduct()),
    findOrCreateByBarcode: jest.fn().mockResolvedValue(fakeProduct({ productType: 'packaged' })),
    findOrCreateByCanonicalKey: jest.fn().mockResolvedValue(fakeProduct({ productType: 'produce' })),
    ...overrides,
  } as unknown as ProductRepository;
}

function parsedProduct(overrides: Partial<ParsedProduct> = {}): ParsedProduct {
  return {
    itemCode: '7290000101605',
    itemName: 'לחם מלא',
    itemPrice: 12.9,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductResolutionService', () => {
  describe('resolve — packaged (with barcode)', () => {
    it('calls findOrCreateByBarcode when barcode is present', async () => {
      const repo = mockProductRepo();
      const service = new ProductResolutionService(repo);

      const result = await service.resolve(
        parsedProduct({ barcode: '7290000101605', itemName: 'חלב תנובה 3%' }),
      );

      expect(result).not.toBeNull();
      expect(result!.productType).toBe('packaged');
      expect(repo.findOrCreateByBarcode).toHaveBeenCalledWith(
        expect.objectContaining({ barcode: '7290000101605' }),
      );
      expect(repo.findOrCreateByCanonicalKey).not.toHaveBeenCalled();
    });

    it('passes cleaned canonicalName and normalizedName', async () => {
      const repo = mockProductRepo();
      const service = new ProductResolutionService(repo);

      await service.resolve(
        parsedProduct({ barcode: '7290000101605', itemName: '  חלב   תנובה  3%  ' }),
      );

      expect(repo.findOrCreateByBarcode).toHaveBeenCalledWith(
        expect.objectContaining({
          canonicalName: 'חלב תנובה 3%',
        }),
      );
    });
  });

  describe('resolve — produce (no barcode, catalog match)', () => {
    it('resolves to produce when name matches catalog', async () => {
      const produceProduct = fakeProduct({
        id: 'prod-tomato',
        productType: 'produce',
        canonicalKey: 'tomato',
      });
      const repo = mockProductRepo({
        findOrCreateByCanonicalKey: jest.fn().mockResolvedValue(produceProduct),
      });
      const service = new ProductResolutionService(repo);

      const result = await service.resolve(
        parsedProduct({ barcode: undefined, itemCode: '100', itemName: 'עגבניות' }),
      );

      expect(result).not.toBeNull();
      expect(result!.productType).toBe('produce');
      expect(result!.product.canonicalKey).toBe('tomato');
      expect(repo.findOrCreateByCanonicalKey).toHaveBeenCalledWith(
        expect.objectContaining({ canonicalKey: 'tomato' }),
      );
    });

    it('resolves produce with longer alias match', async () => {
      const repo = mockProductRepo();
      const service = new ProductResolutionService(repo);

      const result = await service.resolve(
        parsedProduct({ barcode: undefined, itemCode: '200', itemName: 'עגבניות שרי מתוקות' }),
      );

      expect(result).not.toBeNull();
      expect(result!.productType).toBe('produce');
      expect(repo.findOrCreateByCanonicalKey).toHaveBeenCalledWith(
        expect.objectContaining({ canonicalKey: 'tomato-cherry' }),
      );
    });
  });

  describe('resolve — unresolved (no barcode, no catalog match)', () => {
    it('returns null for items that do not match any catalog entry', async () => {
      const repo = mockProductRepo();
      const service = new ProductResolutionService(repo);

      const result = await service.resolve(
        parsedProduct({ barcode: undefined, itemCode: '999', itemName: 'שקית ניילון' }),
      );

      expect(result).toBeNull();
      expect(repo.findOrCreateByBarcode).not.toHaveBeenCalled();
      expect(repo.findOrCreateByCanonicalKey).not.toHaveBeenCalled();
    });
  });

  describe('resolve — produce takes priority over barcode', () => {
    it('resolves as produce even when barcode is present', async () => {
      const repo = mockProductRepo();
      const service = new ProductResolutionService(repo);

      // "עגבניות" matches produce catalog — produce wins even if barcode is present.
      // Shufersal uses weight-embedded EAN-13 codes for fresh produce, so barcode
      // does not imply a packaged product when the name matches the produce catalog.
      const result = await service.resolve(
        parsedProduct({ barcode: '7290000999999', itemName: 'עגבניות' }),
      );

      expect(result).not.toBeNull();
      expect(result!.productType).toBe('produce');
      expect(repo.findOrCreateByCanonicalKey).toHaveBeenCalled();
      expect(repo.findOrCreateByBarcode).not.toHaveBeenCalled();
    });
  });
});
