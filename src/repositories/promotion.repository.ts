import PromotionMongoose from '../infrastructure/db/promotion.mongoose.model';
import { mapPromotion } from '../mappers/promotion.mapper';
import type { Promotion, UpsertPromoData } from '../models/promotion.model';
import type { ChainId } from '../models/chain-product.model';

export class PromotionRepository {
  async bulkUpsertPromos(dataList: UpsertPromoData[]): Promise<number> {
    if (dataList.length === 0) return 0;

    const ops = dataList.map((data) => {
      const itemCodes = [...new Set(data.items.map((item) => item.itemCode))];
      return {
        updateOne: {
          filter: {
            chainId: data.chainId,
            storeId: data.storeId,
            promotionId: data.promotionId,
          },
          update: {
            $set: {
              description: data.description,
              startAt: data.startAt,
              endAt: data.endAt,
              rewardType: data.rewardType,
              discountType: data.discountType,
              discountRate: data.discountRate,
              minQty: data.minQty,
              maxQty: data.maxQty,
              discountedPrice: data.discountedPrice,
              minItemsOffered: data.minItemsOffered,
              items: data.items,
              parsedPromotionKind: data.parsedPromotionKind,
              rawPayload: data.rawPayload,
              promotionUpdateAt: data.promotionUpdateAt,
              discountedPricePerMida: data.discountedPricePerMida,
              allowMultipleDiscounts: data.allowMultipleDiscounts,
              minPurchaseAmount: data.minPurchaseAmount,
              isWeightedPromo: data.isWeightedPromo,
              clubId: data.clubId,
              remarks: data.remarks,
              isGift: data.isGift,
              isCoupon: data.isCoupon,
              isTotal: data.isTotal,
              itemCodes,
              isActive: true,
              lastSeenAt: data.lastSeenAt,
            },
          },
          upsert: true,
        },
      };
    });

    const result = await PromotionMongoose.bulkWrite(ops, { ordered: false });
    return (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0);
  }

  async markInactiveExcept(
    chainId: ChainId,
    storeId: string,
    seenPromotionIds: string[],
  ): Promise<number> {
    if (seenPromotionIds.length === 0) {
      console.warn(
        `[PROMO_REPO] markInactiveExcept skipped chainId=${chainId} storeId=${storeId} because seenPromotionIds is empty`,
      );
      return 0;
    }

    const result = await PromotionMongoose.updateMany(
      { chainId, storeId, promotionId: { $nin: seenPromotionIds }, isActive: true },
      { $set: { isActive: false } },
    );

    return result.modifiedCount;
  }

  async findActiveByChain(chainId: ChainId, now: Date): Promise<Promotion[]> {
    const docs = await PromotionMongoose.find({
      chainId,
      isActive: true,
      $and: [
        { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
        { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
      ],
    }).lean();

    return docs.map(mapPromotion);
  }

  async verifyImport(chainId: ChainId): Promise<void> {
    const total = await PromotionMongoose.countDocuments({ chainId });
    const active = await PromotionMongoose.countDocuments({ chainId, isActive: true });
    const samples = await PromotionMongoose.find({ chainId }).limit(3).lean();

    console.log(
      `[VERIFY_PROMO] chainId=${chainId} total=${total} active=${active} inactive=${total - active}`,
    );
    samples.forEach((sample, index) =>
      console.log(
        `[VERIFY_PROMO] sample[${index}] promotionId=${sample.promotionId} kind=${sample.parsedPromotionKind} items=${sample.items.length} isActive=${sample.isActive}`,
      ),
    );
  }
}
