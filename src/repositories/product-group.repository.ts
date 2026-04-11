import ProductGroupMongoose from '../infrastructure/db/product-group.mongoose.model';
import { mapProductGroup } from '../mappers/product-group.mapper';
import type { ProductGroup } from '../models/product-group.model';

export class ProductGroupRepository {
  async search(query: string, limit = 20): Promise<ProductGroup[]> {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    // Prefix match gets priority via sort
    const docs = await ProductGroupMongoose.find({
      $or: [{ normalizedName: regex }, { normalizedKeywords: regex }],
    })
      .sort({ normalizedName: 1 })
      .limit(limit)
      .lean();

    return docs.map(mapProductGroup);
  }

  async findById(id: string): Promise<ProductGroup | null> {
    const doc = await ProductGroupMongoose.findById(id).lean();
    return doc ? mapProductGroup(doc) : null;
  }

  async findAll(): Promise<ProductGroup[]> {
    const docs = await ProductGroupMongoose.find().sort({ category: 1, name: 1 }).lean();
    return docs.map(mapProductGroup);
  }

  async create(data: {
    name: string;
    normalizedName: string;
    category: string;
    keywords: string[];
    normalizedKeywords: string[];
    includeKeywords?: string[];
    excludeKeywords?: string[];
  }): Promise<ProductGroup> {
    const doc = await ProductGroupMongoose.create(data);
    return mapProductGroup(doc);
  }

  async upsertByName(data: {
    name: string;
    normalizedName: string;
    category: string;
    keywords: string[];
    normalizedKeywords: string[];
    includeKeywords?: string[];
    excludeKeywords?: string[];
  }): Promise<ProductGroup> {
    const doc = await ProductGroupMongoose.findOneAndUpdate(
      { normalizedName: data.normalizedName },
      { $set: data },
      { upsert: true, new: true, runValidators: true },
    );

    return mapProductGroup(doc!);
  }
}
