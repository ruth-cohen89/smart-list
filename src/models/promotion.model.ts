import type { ChainId } from './chain-product.model';

export enum PromotionKind {
  FIXED_PRICE_BUNDLE = 'FIXED_PRICE_BUNDLE',
  PERCENT_DISCOUNT = 'PERCENT_DISCOUNT',
  AMOUNT_OFF = 'AMOUNT_OFF',
  BUY_X_GET_Y = 'BUY_X_GET_Y',
  UNKNOWN = 'UNKNOWN',
}

export interface PromotionItem {
  itemCode: string;
  itemType?: number;
  isGiftItem?: boolean;
}

export interface NormalizedPromotion {
  chainId: ChainId;
  promotionId: string;
  description: string;
  startAt: Date | null;
  endAt: Date | null;
  rewardType?: number;
  discountType?: number;
  discountRate?: number;
  minQty?: number;
  maxQty?: number;
  discountedPrice?: number;
  minItemsOffered?: number;
  items: PromotionItem[];
  parsedPromotionKind: PromotionKind;
  rawPayload: Record<string, unknown>;
  promotionUpdateAt?: Date;
  discountedPricePerMida?: number;
  allowMultipleDiscounts?: boolean;
  minPurchaseAmount?: number;
  isWeightedPromo?: boolean;
  clubId?: string;
  remarks?: string;
  isGift?: boolean;
  isCoupon?: boolean;
  isTotal?: boolean;
}

export interface Promotion extends NormalizedPromotion {
  id: string;
  storeId: string;
  itemCodes: string[];
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertPromoData extends NormalizedPromotion {
  storeId: string;
  lastSeenAt: Date;
}
