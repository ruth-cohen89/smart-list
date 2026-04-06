import type { Promotion } from '../models/promotion.model';
import type { IPromotionDocument } from '../infrastructure/db/promotion.mongoose.model';

export const mapPromotion = (doc: IPromotionDocument): Promotion => ({
  id: String(doc._id),
  chainId: doc.chainId,
  storeId: doc.storeId,
  promotionId: doc.promotionId,
  description: doc.description,
  startAt: doc.startAt,
  endAt: doc.endAt,
  rewardType: doc.rewardType,
  discountType: doc.discountType,
  minQty: doc.minQty,
  maxQty: doc.maxQty,
  discountedPrice: doc.discountedPrice,
  discountedPricePerMida: doc.discountedPricePerMida,
  discountRate: doc.discountRate,
  allowMultipleDiscounts: doc.allowMultipleDiscounts,
  clubId: doc.clubId,
  isGift: doc.isGift,
  isCoupon: doc.isCoupon,
  isTotal: doc.isTotal,
  itemCodes: doc.itemCodes,
  isActive: doc.isActive,
  lastSeenAt: doc.lastSeenAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
