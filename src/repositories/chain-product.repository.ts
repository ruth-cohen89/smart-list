import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import { mapChainProduct } from '../mappers/chain-product.mapper';
import {
  assignPromotionsToProducts,
  type PromotionMergeProduct,
} from '../services/promotion-merge.service';
import type {
  ChainProduct,
  ChainId,
  UpsertChainProductData,
  EmbeddedPromotion,
} from '../models/chain-product.model';

const NAME_CANDIDATE_LIMIT = 30;

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

  async findByBarcode(barcode: string, chainId?: ChainId): Promise<ChainProduct[]> {
    const filter: Record<string, unknown> = { barcode, isActive: true };
    if (chainId) {
      filter.chainId = chainId;
    }

    const docs = await ChainProductMongoose.find(filter).lean();
    return docs.map(mapChainProduct);
  }

  async findCandidatesByName(normalizedName: string, chainId: ChainId): Promise<ChainProduct[]> {
    const firstToken = normalizedName.split(' ').find((token) => token.length >= 2) ?? normalizedName;

    const docs = await ChainProductMongoose.find({
      chainId,
      isActive: true,
      normalizedName: { $regex: firstToken, $options: 'i' },
    })
      .limit(NAME_CANDIDATE_LIMIT)
      .lean();

    return docs.map(mapChainProduct);
  }

  async mergePromotions(
    chainId: ChainId,
    promotionsByItemCode: Map<string, EmbeddedPromotion[]>,
    syncAt: Date,
  ): Promise<number> {
    const itemCodes = [...promotionsByItemCode.keys()];

    await ChainProductMongoose.updateMany(
      { chainId },
      { $set: { promotions: [], hasActivePromotions: false, lastPromotionSyncAt: syncAt } },
    );

    if (itemCodes.length === 0) {
      console.log(`[REPO] mergePromotions chainId=${chainId} no active promotion item codes to merge`);
      return 0;
    }

    const candidateDocs = await ChainProductMongoose.find(
      {
        chainId,
        $or: [{ externalId: { $in: itemCodes } }, { barcode: { $in: itemCodes } }],
      },
      { _id: 1, externalId: 1, barcode: 1 },
    ).lean();

    const mergePlan = assignPromotionsToProducts(
      candidateDocs.map(
        (doc): PromotionMergeProduct => ({
          id: String(doc._id),
          externalId: doc.externalId,
          barcode: doc.barcode,
        }),
      ),
      promotionsByItemCode,
    );

    if (mergePlan.assignments.length === 0) {
      console.log(
        `[REPO] mergePromotions chainId=${chainId} matchedProducts=0 unmatchedItemCodes=${mergePlan.unmatchedItemCodes.length}`,
      );
      return 0;
    }

    await ChainProductMongoose.bulkWrite(
      mergePlan.assignments.map((assignment) => ({
        updateOne: {
          filter: { _id: assignment.productId },
          update: {
            $set: {
              promotions: assignment.promotions,
              hasActivePromotions: assignment.promotions.length > 0,
              lastPromotionSyncAt: syncAt,
            },
          },
        },
      })),
      { ordered: true },
    );

    console.log(
      `[REPO] mergePromotions chainId=${chainId} matchedProducts=${mergePlan.assignments.length} matchedItemCodes=${mergePlan.matchedItemCodes.length} unmatchedItemCodes=${mergePlan.unmatchedItemCodes.length}`,
    );

    return mergePlan.assignments.length;
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
