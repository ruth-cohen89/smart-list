import type { ProductGroup } from '../models/product-group.model';
import type { IProductGroupDocument } from '../infrastructure/db/product-group.mongoose.model';

export const mapProductGroup = (doc: IProductGroupDocument): ProductGroup => ({
  id: String(doc._id),
  name: doc.name,
  normalizedName: doc.normalizedName,
  category: doc.category,
  keywords: doc.keywords,
  normalizedKeywords: doc.normalizedKeywords,
  includeKeywords: doc.includeKeywords ?? [],
  excludeKeywords: doc.excludeKeywords ?? [],
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
