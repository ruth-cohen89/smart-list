import type { ChainProduct } from '../models/chain-product.model';
import { PromotionKind, type NormalizedPromotion } from '../models/promotion.model';
import { hasUsablePromotionWindow, isPromotionActive } from '../utils/promo-utils';

export interface EffectivePriceResult {
  regularTotalPrice: number;
  effectiveTotalPrice: number;
  effectiveUnitPrice: number;
  savings: number;
  appliedPromotion: NormalizedPromotion | null;
}

type PriceableProduct = Pick<ChainProduct, 'price' | 'promotions'>;

export function computeBestEffectivePrice(
  product: PriceableProduct,
  quantity: number,
  now: Date = new Date(),
): EffectivePriceResult {
  const regularTotalPrice = product.price * quantity;
  const fallback: EffectivePriceResult = {
    regularTotalPrice,
    effectiveTotalPrice: regularTotalPrice,
    effectiveUnitPrice: quantity > 0 ? regularTotalPrice / quantity : product.price,
    savings: 0,
    appliedPromotion: null,
  };

  if (quantity <= 0 || product.promotions.length === 0) {
    return fallback;
  }

  let best = fallback;

  for (const promotion of product.promotions) {
    if (promotion.parsedPromotionKind === PromotionKind.UNKNOWN) continue;
    if (promotion.parsedPromotionKind === PromotionKind.BUY_X_GET_Y) continue;
    if (promotion.isCoupon || promotion.isGift) continue;
    if (!hasUsablePromotionWindow(promotion)) continue;
    if (!isPromotionActive(now, promotion.startAt, promotion.endAt)) continue;

    const candidate = applyPromotion(product.price, quantity, promotion);
    if (!candidate) continue;

    if (candidate.effectiveTotalPrice < best.effectiveTotalPrice) {
      best = {
        ...candidate,
        regularTotalPrice,
        savings: regularTotalPrice - candidate.effectiveTotalPrice,
      };
    }
  }

  return best;
}

function applyPromotion(
  basePrice: number,
  quantity: number,
  promotion: NormalizedPromotion,
): Omit<EffectivePriceResult, 'regularTotalPrice' | 'savings'> | null {
  switch (promotion.parsedPromotionKind) {
    case PromotionKind.FIXED_PRICE_BUNDLE:
      return applyBundlePromotion(basePrice, quantity, promotion);
    case PromotionKind.PERCENT_DISCOUNT:
      return applyPercentPromotion(basePrice, quantity, promotion);
    case PromotionKind.AMOUNT_OFF:
      return applyAmountOffPromotion(basePrice, quantity, promotion);
    default:
      return null;
  }
}

function applyBundlePromotion(
  basePrice: number,
  quantity: number,
  promotion: NormalizedPromotion,
): Omit<EffectivePriceResult, 'regularTotalPrice' | 'savings'> | null {
  const bundleSize = promotion.minQty ?? promotion.minItemsOffered;
  const bundlePrice = promotion.discountedPrice;

  if (!bundleSize || bundleSize < 1 || bundlePrice === undefined || bundlePrice <= 0) {
    return null;
  }

  if (promotion.maxQty !== undefined && quantity > promotion.maxQty) {
    return null;
  }

  if (quantity < bundleSize) {
    return null;
  }

  const bundles = Math.floor(quantity / bundleSize);
  const remainder = quantity % bundleSize;
  const total = bundles * bundlePrice + remainder * basePrice;

  return {
    effectiveTotalPrice: total,
    effectiveUnitPrice: total / quantity,
    appliedPromotion: promotion,
  };
}

function applyPercentPromotion(
  basePrice: number,
  quantity: number,
  promotion: NormalizedPromotion,
): Omit<EffectivePriceResult, 'regularTotalPrice' | 'savings'> | null {
  const rate = promotion.discountRate;
  const minQty = promotion.minQty ?? 1;

  if (rate === undefined || rate <= 0 || rate > 100) {
    return null;
  }

  if (quantity < minQty) {
    return null;
  }

  if (promotion.maxQty !== undefined && quantity > promotion.maxQty) {
    return null;
  }

  const unitPrice = basePrice * (1 - rate / 100);
  const total = unitPrice * quantity;

  return {
    effectiveTotalPrice: total,
    effectiveUnitPrice: total / quantity,
    appliedPromotion: promotion,
  };
}

function applyAmountOffPromotion(
  basePrice: number,
  quantity: number,
  promotion: NormalizedPromotion,
): Omit<EffectivePriceResult, 'regularTotalPrice' | 'savings'> | null {
  const amountOff = promotion.discountRate;
  const minQty = promotion.minQty ?? 1;

  if (amountOff === undefined || amountOff <= 0) {
    return null;
  }

  if (quantity < minQty) {
    return null;
  }

  if (promotion.maxQty !== undefined && quantity > promotion.maxQty) {
    return null;
  }

  const unitPrice = Math.max(0, basePrice - amountOff);
  const total = unitPrice * quantity;

  return {
    effectiveTotalPrice: total,
    effectiveUnitPrice: total / quantity,
    appliedPromotion: promotion,
  };
}
