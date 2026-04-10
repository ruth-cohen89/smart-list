import { Types } from 'mongoose';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { mapChainProduct } from '../mappers/chain-product.mapper';
import type {
  ChainProduct,
  ChainId,
  UpsertChainProductData,
  ProductPromotionSnapshot,
} from '../models/chain-product.model';

const NAME_CANDIDATE_LIMIT = 80;

export class ChainProductRepository {
  async upsertProduct(data: UpsertChainProductData): Promise<ChainProduct> {
    const setFields: Record<string, unknown> = {
      originalName: data.originalName,
      normalizedName: data.normalizedName,
      price: data.price,
      unit: data.unit,
      quantity: data.quantity,
      isActive: true,
      lastSeenAt: data.lastSeenAt,
    };

    if (data.productId) setFields.productId = new Types.ObjectId(data.productId);
    if (data.productType) setFields.productType = data.productType;
    if (data.priceUpdateDate) setFields.priceUpdateDate = data.priceUpdateDate;
    if (data.unitType) setFields.unitType = data.unitType;

    const update: Record<string, unknown> = { $set: setFields };
    if (data.barcode) {
      setFields.barcode = data.barcode;
    } else {
      update.$unset = { barcode: '' };
    }

    const doc = await ChainProductMongoose.findOneAndUpdate(
      { chainId: data.chainId, externalId: data.externalId },
      update,
      { upsert: true, new: true, runValidators: true },
    );

    if (!doc) {
      throw new Error('upsertProduct: unexpected null document');
    }

    return mapChainProduct(doc);
  }

  async markInactiveExcept(chainId: ChainId, seenExternalIds: string[]): Promise<number> {
    if (seenExternalIds.length === 0) {
      console.warn(
        `[REPO] markInactiveExcept skipped for chainId=${chainId} because seenExternalIds is empty`,
      );
      return 0;
    }

    const result = await ChainProductMongoose.updateMany(
      { chainId, externalId: { $nin: seenExternalIds }, isActive: true },
      { $set: { isActive: false } },
    );

    return result.modifiedCount;
  }

  async findByProductId(productId: string, chainId?: ChainId): Promise<ChainProduct[]> {
    const filter: Record<string, unknown> = {
      productId: new Types.ObjectId(productId),
      isActive: true,
    };
    if (chainId) filter.chainId = chainId;

    const docs = await ChainProductMongoose.find(filter).lean();
    return docs.map(mapChainProduct);
  }

  async findByBarcode(barcode: string, chainId?: ChainId): Promise<ChainProduct[]> {
    const filter: Record<string, unknown> = { barcode, isActive: true };
    if (chainId) {
      filter.chainId = chainId;
    }

    const docs = await ChainProductMongoose.find(filter).lean();
    return docs.map(mapChainProduct);
  }

  async findCandidatesByName(normalizedName: string, chainId: ChainId): Promise<ChainProduct[]> {
    const tokens = normalizedName
      .split(' ')
      .filter((t) => t.length >= 2)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // escape regex chars

    if (tokens.length === 0) {
      // Fallback: use entire input as regex
      const escaped = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!escaped) return [];
      tokens.push(escaped);
    }

    const regexPattern = tokens.length === 1 ? tokens[0] : `(${tokens.join('|')})`;

    const docs = await ChainProductMongoose.find({
      chainId,
      isActive: true,
      normalizedName: { $regex: regexPattern, $options: 'i' },
    })
      .limit(NAME_CANDIDATE_LIMIT)
      .lean();

    return docs.map(mapChainProduct);
  }

  async findByExternalId(externalId: string, chainId: ChainId): Promise<ChainProduct | null> {
    const doc = await ChainProductMongoose.findOne({
      chainId,
      externalId,
      isActive: true,
    }).lean();

    return doc ? mapChainProduct(doc) : null;
  }

  async mergePromotions(
    chainId: ChainId,
    promotionsByItemCode: Map<string, ProductPromotionSnapshot[]>,
    syncAt: Date,
  ): Promise<number> {
    const itemCodes = [...promotionsByItemCode.keys()];

    console.log(
      `[REPO] mergePromotions chainId=${chainId} itemCodes=${itemCodes.length} resetStart`,
    );
    const resetResult = await ChainProductMongoose.updateMany(
      { chainId, isActive: true, hasActivePromotions: true },
      { $set: { promotions: [], hasActivePromotions: false, lastPromotionSyncAt: syncAt } },
    );
    console.log(
      `[REPO] mergePromotions chainId=${chainId} resetDone modified=${resetResult.modifiedCount}`,
    );

    if (itemCodes.length === 0) {
      console.log(
        `[REPO] mergePromotions chainId=${chainId} no active promotion item codes to merge`,
      );
      return 0;
    }

    // Process in chunks end-to-end: query candidates, assign, bulkWrite per chunk
    const QUERY_CHUNK = 5000;
    const WRITE_CHUNK = 500;
    let totalUpdated = 0;
    let chunkIndex = 0;

    for (let i = 0; i < itemCodes.length; i += QUERY_CHUNK) {
      chunkIndex++;
      const codeChunk = itemCodes.slice(i, i + QUERY_CHUNK);

      // 1. Fetch candidate products for this chunk of item codes
      const docs = await ChainProductMongoose.find(
        {
          chainId,
          isActive: true,
          $or: [{ externalId: { $in: codeChunk } }, { barcode: { $in: codeChunk } }],
        },
        { _id: 1, externalId: 1, barcode: 1 },
      ).lean();

      console.log(
        `[REPO] mergePromotions chainId=${chainId} chunk=${chunkIndex} candidates=${docs.length}`,
      );

      if (docs.length === 0) continue;

      // 2. Assign promotions to products for this chunk
      const ops: Array<{
        filter: { _id: Types.ObjectId };
        update: { $set: { promotions: ProductPromotionSnapshot[]; hasActivePromotions: boolean; lastPromotionSyncAt: Date } };
      }> = [];

      for (const doc of docs) {
        const combined = new Map<string, ProductPromotionSnapshot>();
        const codes = [doc.externalId, doc.barcode].filter(
          (v): v is string => Boolean(v),
        );

        for (const code of codes) {
          const promos = promotionsByItemCode.get(code);
          if (!promos) continue;
          for (const promo of promos) {
            combined.set(promo.promotionId, promo);
          }
        }

        if (combined.size === 0) continue;

        const snapshots = [...combined.values()];
        ops.push({
          filter: { _id: doc._id as Types.ObjectId },
          update: {
            $set: {
              promotions: snapshots,
              hasActivePromotions: true,
              lastPromotionSyncAt: syncAt,
            },
          },
        });
      }

      console.log(
        `[REPO] mergePromotions chainId=${chainId} chunk=${chunkIndex} assignments=${ops.length}`,
      );

      // 3. BulkWrite in sub-chunks, then release
      for (let w = 0; w < ops.length; w += WRITE_CHUNK) {
        const writeChunk = ops.slice(w, w + WRITE_CHUNK);
        await ChainProductMongoose.bulkWrite(
          writeChunk.map((op) => ({ updateOne: op })),
          { ordered: false },
        );
      }

      totalUpdated += ops.length;
      // ops and docs go out of scope here, freeing memory before next chunk
    }

    console.log(
      `[REPO] mergePromotions chainId=${chainId} done totalUpdated=${totalUpdated}`,
    );

    return totalUpdated;
  }

  async verifyImport(chainId: ChainId): Promise<void> {
    const total = await ChainProductMongoose.countDocuments({ chainId });
    const active = await ChainProductMongoose.countDocuments({ chainId, isActive: true });
    const inactive = total - active;
    const samples = await ChainProductMongoose.find({ chainId }).limit(3).lean();

    console.log(`[VERIFY] chainId=${chainId} total=${total} active=${active} inactive=${inactive}`);
    samples.forEach((sample, index) =>
      console.log(
        `[VERIFY] sample[${index}] externalId=${sample.externalId} name="${sample.originalName}" price=${sample.price} isActive=${sample.isActive} promos=${sample.promotions?.length ?? 0}`,
      ),
    );
  }
}
