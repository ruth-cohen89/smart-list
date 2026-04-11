import ProductMongoose from '../infrastructure/db/product.mongoose.model';
import { mapProduct } from '../mappers/product.mapper';
import type { Product, ProductType } from '../models/product.model';

export interface ProductSearchResult {
  id: string;
  name: string;
  barcode: string;
  imageUrl?: string;
}

export class ProductRepository {
  async searchByName(query: string, limit = 15): Promise<ProductSearchResult[]> {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const docs = await ProductMongoose.find({
      barcode: { $exists: true, $ne: null, $gt: '' },
      $or: [{ normalizedName: regex }, { canonicalName: regex }],
    })
      .sort({ normalizedName: 1 })
      .limit(limit)
      .select('_id canonicalName barcode imageUrl')
      .lean();

    return docs.map((doc) => ({
      id: String(doc._id),
      name: doc.canonicalName,
      barcode: doc.barcode!,
      ...(doc.imageUrl ? { imageUrl: doc.imageUrl } : {}),
    }));
  }


  async findByBarcode(barcode: string): Promise<Product | null> {
    const doc = await ProductMongoose.findOne({ barcode }).lean();
    return doc ? mapProduct(doc) : null;
  }

  async findByCanonicalKey(canonicalKey: string): Promise<Product | null> {
    const doc = await ProductMongoose.findOne({ canonicalKey }).lean();
    return doc ? mapProduct(doc) : null;
  }

  async createProduct(data: {
    productType: ProductType;
    barcode?: string | null;
    canonicalKey?: string | null;
    canonicalName: string;
    normalizedName: string;
    brand?: string;
    category?: string;
    unitType?: 'ק"ג' | 'יחידה';
    isWeighted?: boolean;
  }): Promise<Product> {
    const doc = await ProductMongoose.create(data);
    return mapProduct(doc);
  }

  async findOrCreateByBarcode(data: {
    barcode: string;
    canonicalName: string;
    normalizedName: string;
    brand?: string;
    category?: string;
  }): Promise<Product> {
    const existing = await this.findByBarcode(data.barcode);
    if (existing) return existing;

    return this.createProduct({
      productType: 'packaged',
      barcode: data.barcode,
      canonicalName: data.canonicalName,
      normalizedName: data.normalizedName,
      brand: data.brand,
      category: data.category,
    });
  }

  async findOrCreateByCanonicalKey(data: {
    canonicalKey: string;
    canonicalName: string;
    normalizedName: string;
    category?: string;
    unitType?: 'ק"ג' | 'יחידה';
    isWeighted?: boolean;
  }): Promise<Product> {
    const existing = await this.findByCanonicalKey(data.canonicalKey);
    if (existing) return existing;

    return this.createProduct({
      productType: 'produce',
      canonicalKey: data.canonicalKey,
      canonicalName: data.canonicalName,
      normalizedName: data.normalizedName,
      category: data.category,
      unitType: data.unitType,
      isWeighted: data.isWeighted,
    });
  }
}
