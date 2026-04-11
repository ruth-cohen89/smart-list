import type { ProductVariant } from '../models/product-variant.model';
import type { IProductVariantDocument } from '../infrastructure/db/product-variant.mongoose.model';

export const mapProductVariant = (doc: IProductVariantDocument): ProductVariant => ({
  id: String(doc._id),
  groupId: String(doc.groupId),
  name: doc.name,
  keywords: doc.keywords,
  normalizedKeywords: doc.normalizedKeywords,
  includeKeywords: doc.includeKeywords ?? [],
  excludeKeywords: doc.excludeKeywords ?? [],
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
