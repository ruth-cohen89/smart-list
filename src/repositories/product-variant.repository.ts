import { Types } from 'mongoose';
import ProductVariantMongoose from '../infrastructure/db/product-variant.mongoose.model';
import { mapProductVariant } from '../mappers/product-variant.mapper';
import type { ProductVariant } from '../models/product-variant.model';

export class ProductVariantRepository {
  async findByGroupId(groupId: string): Promise<ProductVariant[]> {
    const docs = await ProductVariantMongoose.find({
      groupId: new Types.ObjectId(groupId),
    })
      .sort({ name: 1 })
      .lean();

    return docs.map(mapProductVariant);
  }

  async findById(id: string): Promise<ProductVariant | null> {
    const doc = await ProductVariantMongoose.findById(id).lean();
    return doc ? mapProductVariant(doc) : null;
  }

  async create(data: {
    groupId: string;
    name: string;
    keywords: string[];
    normalizedKeywords: string[];
    includeKeywords?: string[];
    excludeKeywords?: string[];
  }): Promise<ProductVariant> {
    const doc = await ProductVariantMongoose.create({
      ...data,
      groupId: new Types.ObjectId(data.groupId),
    });
    return mapProductVariant(doc);
  }

  async upsertByGroupAndName(data: {
    groupId: string;
    name: string;
    keywords: string[];
    normalizedKeywords: string[];
    includeKeywords?: string[];
    excludeKeywords?: string[];
  }): Promise<ProductVariant> {
    const doc = await ProductVariantMongoose.findOneAndUpdate(
      { groupId: new Types.ObjectId(data.groupId), name: data.name },
      {
        $set: {
          keywords: data.keywords,
          normalizedKeywords: data.normalizedKeywords,
          includeKeywords: data.includeKeywords ?? [],
          excludeKeywords: data.excludeKeywords ?? [],
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    return mapProductVariant(doc!);
  }
}
