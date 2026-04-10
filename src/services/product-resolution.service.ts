import { ProductRepository } from '../repositories/product.repository';
import { matchProduceCanonical } from '../data/produce-catalog';
import { normalizeName } from '../utils/normalize';
import type { Product, ProductType } from '../models/product.model';
import type { ParsedProduct } from '../infrastructure/catalog-import/price-file.parser';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ResolvedProduct {
  product: Product;
  productType: ProductType;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ProductResolutionService {
  constructor(private readonly productRepo: ProductRepository) {}

  /**
   * Resolve a parsed catalog item to a global Product.
   *
   * STEP 1 — If barcode exists → packaged product (find-or-create by barcode)
   * STEP 2 — If no barcode → try produce catalog match by normalized name
   *          If match → produce product (find-or-create by canonicalKey)
   * STEP 3 — No match → return null (leave unresolved safely)
   */
  async resolve(parsed: ParsedProduct): Promise<ResolvedProduct | null> {
    const normalizedName = normalizeName(parsed.itemName);

    // STEP 1: Barcode → packaged
    if (parsed.barcode) {
      const product = await this.productRepo.findOrCreateByBarcode({
        barcode: parsed.barcode,
        canonicalName: cleanCanonicalName(parsed.itemName),
        normalizedName,
        brand: parsed.manufacturerName,
      });
      return { product, productType: 'packaged' };
    }

    // STEP 2: No barcode → try produce match
    const produceMatch = matchProduceCanonical(normalizedName);
    if (produceMatch) {
      const entry = produceMatch.entry;
      const product = await this.productRepo.findOrCreateByCanonicalKey({
        canonicalKey: entry.canonicalKey,
        canonicalName: entry.canonicalName,
        normalizedName: entry.normalizedName,
        category: entry.category,
        unitType: entry.unitType,
        isWeighted: entry.isWeighted,
      });
      return { product, productType: 'produce' };
    }

    // STEP 3: Unresolved
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clean up a product name for use as canonicalName.
 * Trims whitespace and collapses multiple spaces.
 */
function cleanCanonicalName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}
