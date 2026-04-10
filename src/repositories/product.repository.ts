import ProductMongoose from '../infrastructure/db/product.mongoose.model';
import { mapProduct } from '../mappers/product.mapper';
import type { Product, ProductType } from '../models/product.model';

export class ProductRepository {
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
