import { PromotionKind } from './promotion.model';
import type { ProductType } from './product.model';

export type ChainId = 'shufersal' | 'rami-levy' | 'machsanei-hashuk';

export const SUPPORTED_CHAINS: ChainId[] = ['shufersal', 'rami-levy', 'machsanei-hashuk'];

/** Lightweight promotion snapshot stored on ChainProduct.promotions.
 *  Full promotion details live in the Promotion collection. */
export interface ProductPromotionSnapshot {
  chainId: ChainId;
  promotionId: string;
  description: string;
  startAt: Date | null;
  endAt: Date | null;
  parsedPromotionKind: PromotionKind;
  discountType?: number;
  discountRate?: number;
  discountedPrice?: number;
  minQty?: number;
  maxQty?: number;
  minItemsOffered?: number;
  discountedPricePerMida?: number;
  minPurchaseAmount?: number;
  isWeightedPromo?: boolean;
  allowMultipleDiscounts?: boolean;
  isGift?: boolean;
  isCoupon?: boolean;
  isTotal?: boolean;
  clubId?: string;
  remarks?: string;
}

export type EmbeddedPromotion = ProductPromotionSnapshot;

export interface ChainProduct {
  id: string;
  chainId: ChainId;
  productId?: string;
  productType?: ProductType;
  externalId: string;
  barcode?: string;
  originalName: string;
  normalizedName: string;
  price: number;
  priceUpdateDate?: Date;
  unit?: string;
  quantity?: number;
  unitType?: string;
  isActive: boolean;
  lastSeenAt: Date;
  imageUrl?: string;
  promotions: ProductPromotionSnapshot[];
  hasActivePromotions: boolean;
  lastPromotionSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertChainProductData {
  chainId: ChainId;
  productId?: string;
  productType?: ProductType;
  externalId: string;
  barcode?: string;
  originalName: string;
  normalizedName: string;
  price: number;
  priceUpdateDate?: Date;
  unit?: string;
  quantity?: number;
  unitType?: string;
  lastSeenAt: Date;
  imageUrl?: string;
}
