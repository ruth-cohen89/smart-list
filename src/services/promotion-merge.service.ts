import type { NormalizedPromotion } from '../models/promotion.model';

export interface PromotionMergeProduct {
  id: any;
  externalId: string;
  barcode?: string;
}

export interface ProductPromotionAssignment {
  productId: any;
  promotions: NormalizedPromotion[];
}

export interface PromotionMergePlan {
  assignments: ProductPromotionAssignment[];
  matchedItemCodes: string[];
  unmatchedItemCodes: string[];
}

export function assignPromotionsToProducts(
  products: PromotionMergeProduct[],
  promotionsByItemCode: Map<string, NormalizedPromotion[]>,
): PromotionMergePlan {
  const assignments: ProductPromotionAssignment[] = [];
  const matchedItemCodes = new Set<string>();

  for (const product of products) {
    const combinedPromotions = new Map<string, NormalizedPromotion>();
    const productCodes = [product.externalId, product.barcode].filter(
      (value): value is string => Boolean(value),
    );

    for (const code of productCodes) {
      const promotions = promotionsByItemCode.get(code);
      if (!promotions) continue;

      matchedItemCodes.add(code);
      for (const promotion of promotions) {
        combinedPromotions.set(promotion.promotionId, promotion);
      }
    }

    if (combinedPromotions.size === 0) continue;

    assignments.push({
      productId: product.id,
      promotions: [...combinedPromotions.values()],
    });
  }

  const unmatchedItemCodes = [...promotionsByItemCode.keys()].filter((code) => !matchedItemCodes.has(code));

  return {
    assignments,
    matchedItemCodes: [...matchedItemCodes],
    unmatchedItemCodes,
  };
}
