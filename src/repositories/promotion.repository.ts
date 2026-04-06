import PromotionMongoose from '../infrastructure/db/promotion.mongoose.model';
import { mapPromotion } from '../mappers/promotion.mapper';
import type { Promotion, UpsertPromoData } from '../models/promotion.model';
import type { ChainId } from '../models/chain-product.model';

export class PromotionRepository {
  /**
   * Insert or update a promotion identified by { chainId, storeId, promotionId }.
   * Also marks the promotion active and updates lastSeenAt.
   * Safe for concurrent import jobs — uses findOneAndUpdate with upsert.
   */
  async upsertPromo(data: UpsertPromoData): Promise<Promotion> {
    const doc = await PromotionMongoose.findOneAndUpdate(
      { chainId: data.chainId, storeId: data.storeId, promotionId: data.promotionId },
      {
        $set: {
          description: data.description,
          startAt: data.startAt,
          endAt: data.endAt,
          rewardType: data.rewardType,
          discountType: data.discountType,
          minQty: data.minQty,
          maxQty: data.maxQty,
          discountedPrice: data.discountedPrice,
          discountedPricePerMida: data.discountedPricePerMida,
          discountRate: data.discountRate,
          allowMultipleDiscounts: data.allowMultipleDiscounts,
          clubId: data.clubId,
          isGift: data.isGift,
          isCoupon: data.isCoupon,
          isTotal: data.isTotal,
          itemCodes: data.itemCodes,
          isActive: true,
          lastSeenAt: data.lastSeenAt,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    if (!doc) throw new Error('upsertPromo: unexpected null document');
    return mapPromotion(doc);
  }

  /**
   * Mark all active promotions for a chain+store as inactive EXCEPT those in seenPromotionIds.
   * Called after an import loop to deactivate promotions no longer in the latest file.
   * Scoped to storeId because a promotionId can differ per store.
   * Returns the number of documents actually modified.
   */
  async markInactiveExcept(
    chainId: ChainId,
    storeId: string,
    seenPromotionIds: string[],
  ): Promise<number> {
    if (seenPromotionIds.length === 0) {
      console.warn(
        `[PROMO_REPO] markInactiveExcept — skipped for chainId=${chainId} storeId=${storeId}: seenPromotionIds is empty`,
      );
      return 0;
    }
    const result = await PromotionMongoose.updateMany(
      { chainId, storeId, promotionId: { $nin: seenPromotionIds }, isActive: true },
      { $set: { isActive: false } },
    );
    return result.modifiedCount;
  }

  /** DEV ONLY — print a quick summary of what is stored for a chain. */
  async verifyImport(chainId: ChainId): Promise<void> {
    const total = await PromotionMongoose.countDocuments({ chainId });
    const active = await PromotionMongoose.countDocuments({ chainId, isActive: true });
    const samples = await PromotionMongoose.find({ chainId }).limit(3).lean();

    console.log(
      `[VERIFY_PROMO] chainId=${chainId} total=${total} active=${active} inactive=${total - active}`,
    );
    samples.forEach((s, i) =>
      console.log(
        `[VERIFY_PROMO] sample[${i}] promotionId=${s.promotionId} desc="${s.description}" items=${s.itemCodes.length} isActive=${s.isActive}`,
      ),
    );
  }
}
