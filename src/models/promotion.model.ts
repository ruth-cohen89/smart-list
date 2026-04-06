import type { ChainId } from './chain-product.model';

/**
 * A normalized promotion record sourced from a chain's PromoFull file.
 * Populated by the promo import job. Base prices are never overwritten here.
 *
 * MVP application scope:
 *   - clubId / isGift / isCoupon / isTotal flags are preserved so compare logic
 *     can skip unsupported promo types later.
 *   - For bundle promotions (e.g. "3 for 10"), compute:
 *       bundles = floor(qty / minQty)
 *       total   = bundles * discountedPrice + (qty % minQty) * basePrice
 */
export interface Promotion {
  id: string;
  chainId: ChainId;
  storeId: string;
  promotionId: string;
  description: string;
  startAt: Date | null;
  endAt: Date | null;
  rewardType?: number;
  discountType?: number;
  minQty?: number;
  maxQty?: number;
  discountedPrice?: number;
  discountedPricePerMida?: number;
  discountRate?: number;
  allowMultipleDiscounts?: boolean;
  clubId?: string;
  isGift?: boolean;
  isCoupon?: boolean;
  isTotal?: boolean;
  /** itemCodes linked to this promotion (EAN barcodes or internal chain codes). */
  itemCodes: string[];
  /** False when the promotion was not seen in the most recent import. */
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Input shape for the upsert operation used by promo import jobs. */
export interface UpsertPromoData {
  chainId: ChainId;
  storeId: string;
  promotionId: string;
  description: string;
  startAt: Date | null;
  endAt: Date | null;
  rewardType?: number;
  discountType?: number;
  minQty?: number;
  maxQty?: number;
  discountedPrice?: number;
  discountedPricePerMida?: number;
  discountRate?: number;
  allowMultipleDiscounts?: boolean;
  clubId?: string;
  isGift?: boolean;
  isCoupon?: boolean;
  isTotal?: boolean;
  itemCodes: string[];
  lastSeenAt: Date;
}
