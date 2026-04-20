import type { ChainProduct, ProductPromotionSnapshot } from '../models/chain-product.model';
import { PromotionKind } from '../models/promotion.model';
import { hasUsablePromotionWindow, isPromotionActive } from '../utils/promo-utils';

export interface EffectivePriceResult {
  regularTotalPrice: number;
  effectiveTotalPrice: number;
  effectiveUnitPrice: number;
  savings: number;
  appliedPromotion: ProductPromotionSnapshot | null;
}

type PriceableProduct = Pick<ChainProduct, 'price' | 'promotions'>;

export function computeBestEffectivePrice(
  product: PriceableProduct,
  quantity: number,
  unit?: string,
  now: Date = new Date(),
): EffectivePriceResult {
  // Catalog price for weighted items is always per-KG.
  // Convert G → KG before all price math. Anything else = no conversion.
  const effectiveQty = unit === 'G' ? quantity / 1000 : quantity;

  const regularTotalPrice = product.price * effectiveQty;
  const fallback: EffectivePriceResult = {
    regularTotalPrice,
    effectiveTotalPrice: regularTotalPrice,
    effectiveUnitPrice: effectiveQty > 0 ? regularTotalPrice / effectiveQty : product.price,
    savings: 0,
    appliedPromotion: null,
  };

  if (effectiveQty <= 0 || product.promotions.length === 0) {
    return fallback;
  }

  let best = fallback;

  for (const promotion of product.promotions) {
    if (promotion.parsedPromotionKind === PromotionKind.UNKNOWN) continue;
    if (promotion.parsedPromotionKind === PromotionKind.BUY_X_GET_Y) continue;
    if (promotion.isCoupon || promotion.isGift) continue;
    if (!hasUsablePromotionWindow(promotion)) continue;
    if (!isPromotionActive(now, promotion.startAt, promotion.endAt)) continue;

    const candidate = applyPromotion(product.price, effectiveQty, promotion);
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
  promotion: ProductPromotionSnapshot,
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
  promotion: ProductPromotionSnapshot,
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
  promotion: ProductPromotionSnapshot,
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
  promotion: ProductPromotionSnapshot,
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
