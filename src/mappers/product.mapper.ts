import type { Product } from '../models/product.model';
import type { IProductDocument } from '../infrastructure/db/product.mongoose.model';

export const mapProduct = (doc: IProductDocument): Product => ({
  id: String(doc._id),
  productType: doc.productType,
  barcode: doc.barcode,
  canonicalKey: doc.canonicalKey,
  canonicalName: doc.canonicalName,
  normalizedName: doc.normalizedName,
  brand: doc.brand,
  category: doc.category,
  unitType: doc.unitType,
  isWeighted: doc.isWeighted,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
