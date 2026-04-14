import type { ProductGroup } from '../models/product-group.model';
import type { IProductGroupDocument } from '../infrastructure/db/product-group.mongoose.model';

export const mapProductGroup = (doc: IProductGroupDocument): ProductGroup => ({
  id: String(doc._id),
  name: doc.name,
  normalizedName: doc.normalizedName,
  department: doc.department ?? '',
  category: doc.category,
  selectionMode: doc.selectionMode ?? 'canonical',
  keywords: doc.keywords,
  normalizedKeywords: doc.normalizedKeywords,
  includeKeywords: doc.includeKeywords ?? [],
  excludeKeywords: doc.excludeKeywords ?? [],
  priority: doc.priority ?? 0,
  aliases: doc.aliases ?? [],
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
