import type { ParsedPromotionFile, ParsedPromotionRecord } from './promo-file.parser';
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
  ensureArray,
  extractStoreIdFromFilename,
  parsePromotionXmlDocument,
} from './promo-file.parser';

interface MahsaneiHashukSaleNode {
  PromotionID?: number | string;
  PromotionDescription?: string;
  PromotionUpdateDate?: string;
  PromotionStartDate?: string;
  PromotionStartHour?: string;
  PromotionEndDate?: string;
  PromotionEndHour?: string;
  RewardType?: number | string;
  DiscountType?: number | string;
  DiscountRate?: number | string;
  MinQty?: number | string;
  MaxQty?: number | string;
  DiscountedPrice?: number | string;
  DiscountedPricePerMida?: number | string;
  MinNoOfItemsOffered?: number | string;
  AllowMultipleDiscounts?: number | string;
  MinPurchaseAmount?: number | string;
  IsWeightedPromo?: number | string;
  ClubID?: number | string;
  Remarks?: string;
  IsGift?: number | string;
  IsCoupon?: number | string;
  IsTotal?: number | string;
  ItemCode?: number | string;
  ItemType?: number | string;
  IsGiftItem?: number | string;
}

interface MahsaneiHashukPromotionDocument {
  Promos?: {
    StoreID?: number | string;
    Sales?: {
      Sale?: MahsaneiHashukSaleNode | MahsaneiHashukSaleNode[];
    };
  };
}

export function parseMahsaneiHashukPromotionFile(
  xmlData: Buffer | string,
  filename = '',
): ParsedPromotionFile {
  const document = parsePromotionXmlDocument<MahsaneiHashukPromotionDocument>(xmlData);
  const root = document.Promos;

  if (!root) {
    throw new Error('[PROMO_PARSE] Mahsanei Hashuk promotion file is missing Promos');
  }

  const groupedPromotions = new Map<string, ParsedPromotionRecord>();

  for (const sale of ensureArray(root.Sales?.Sale)) {
    const promotionId = coerceString(sale.PromotionID);
    if (!promotionId) {
      continue;
    }

    if (!groupedPromotions.has(promotionId)) {
      groupedPromotions.set(promotionId, {
        promotionId,
        description: coerceString(sale.PromotionDescription) ?? '',
        promotionUpdateDate: coerceString(sale.PromotionUpdateDate),
        startDate: coerceString(sale.PromotionStartDate),
        startHour: coerceString(sale.PromotionStartHour),
        endDate: coerceString(sale.PromotionEndDate),
        endHour: coerceString(sale.PromotionEndHour),
        rewardType: coerceNumber(sale.RewardType),
        discountType: coerceNumber(sale.DiscountType),
        discountRate: coerceNumber(sale.DiscountRate),
        minQty: coerceNumber(sale.MinQty),
        maxQty: coerceNumber(sale.MaxQty),
        discountedPrice: coerceNumber(sale.DiscountedPrice),
        minItemsOffered: coerceNumber(sale.MinNoOfItemsOffered),
        items: [],
        rawPayload: { ...sale },
        discountedPricePerMida: coerceNumber(sale.DiscountedPricePerMida),
        allowMultipleDiscounts: coerceBoolean(sale.AllowMultipleDiscounts),
        minPurchaseAmount: coerceNumber(sale.MinPurchaseAmount),
        isWeightedPromo: coerceBoolean(sale.IsWeightedPromo),
        clubId: coerceString(sale.ClubID),
        remarks: coerceString(sale.Remarks),
        isGift: coerceBoolean(sale.IsGift),
        isCoupon: coerceBoolean(sale.IsCoupon),
        isTotal: coerceBoolean(sale.IsTotal),
      });
    }

    const promotion = groupedPromotions.get(promotionId)!;
    const itemCode = coerceString(sale.ItemCode);
    if (!itemCode) {
      continue;
    }

    promotion.items.push({
      itemCode,
      itemType: coerceNumber(sale.ItemType),
      isGiftItem: coerceBoolean(sale.IsGiftItem),
    });
  }

  const promotions = [...groupedPromotions.values()];
  console.log(
    `[PROMO_PARSE] Mahsanei Hashuk grouped promotions=${promotions.length} from sales=${ensureArray(root.Sales?.Sale).length}`,
  );

  return {
    storeId: coerceString(root.StoreID) ?? extractStoreIdFromFilename(filename),
    promotions,
  };
}
