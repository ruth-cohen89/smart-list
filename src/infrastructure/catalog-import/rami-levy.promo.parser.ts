import type {
  ParsedPromotionFile,
  ParsedPromotionItem,
  ParsedPromotionRecord,
} from './promo-file.parser';
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
  ensureArray,
  extractStoreIdFromFilename,
  parsePromotionXmlDocument,
} from './promo-file.parser';

interface RamiLevyPromotionItemNode {
  ItemCode?: number | string;
  ItemType?: number | string;
  IsGiftItem?: number | string;
}

interface RamiLevyPromotionNode {
  PromotionId?: number | string;
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
  MAXQTY?: number | string;
  DiscountedPrice?: number | string;
  DiscountedPricePerMida?: number | string;
  MinNoOfItemsOffered?: number | string;
  MinNoOfItemOfered?: number | string;
  AllowMultipleDiscounts?: number | string;
  MinPurchaseAmount?: number | string;
  IsWeightedPromo?: number | string;
  ClubId?: number | string;
  Remarks?: string;
  IsGift?: number | string;
  IsCoupon?: number | string;
  IsTotal?: number | string;
  PromotionItems?: {
    Item?: RamiLevyPromotionItemNode | RamiLevyPromotionItemNode[];
  };
}

interface RamiLevyPromotionDocument {
  Root?: {
    StoreId?: number | string;
    Promotions?: {
      Promotion?: RamiLevyPromotionNode | RamiLevyPromotionNode[];
    };
  };
}

function parsePromotionItems(
  value: RamiLevyPromotionNode['PromotionItems'],
): ParsedPromotionItem[] {
  const items: ParsedPromotionItem[] = [];

  for (const item of ensureArray(value?.Item)) {
    const itemCode = coerceString(item.ItemCode);
    if (!itemCode) {
      continue;
    }

    items.push({
      itemCode,
      itemType: coerceNumber(item.ItemType),
      isGiftItem: coerceBoolean(item.IsGiftItem),
    });
  }

  return items;
}

function normalizePromotion(node: RamiLevyPromotionNode): ParsedPromotionRecord | null {
  const promotionId = coerceString(node.PromotionId);
  if (!promotionId) {
    return null;
  }

  return {
    promotionId,
    description: coerceString(node.PromotionDescription) ?? '',
    promotionUpdateDate: coerceString(node.PromotionUpdateDate),
    startDate: coerceString(node.PromotionStartDate),
    startHour: coerceString(node.PromotionStartHour),
    endDate: coerceString(node.PromotionEndDate),
    endHour: coerceString(node.PromotionEndHour),
    rewardType: coerceNumber(node.RewardType),
    discountType: coerceNumber(node.DiscountType),
    discountRate: coerceNumber(node.DiscountRate),
    minQty: coerceNumber(node.MinQty),
    maxQty: coerceNumber(node.MAXQTY ?? node.MaxQty),
    discountedPrice: coerceNumber(node.DiscountedPrice),
    minItemsOffered: coerceNumber(node.MinNoOfItemsOffered ?? node.MinNoOfItemOfered),
    items: parsePromotionItems(node.PromotionItems),
    rawPayload: { ...node },
    discountedPricePerMida: coerceNumber(node.DiscountedPricePerMida),
    allowMultipleDiscounts: coerceBoolean(node.AllowMultipleDiscounts),
    minPurchaseAmount: coerceNumber(node.MinPurchaseAmount),
    isWeightedPromo: coerceBoolean(node.IsWeightedPromo),
    clubId: coerceString(node.ClubId),
    remarks: coerceString(node.Remarks),
    isGift: coerceBoolean(node.IsGift),
    isCoupon: coerceBoolean(node.IsCoupon),
    isTotal: coerceBoolean(node.IsTotal),
  };
}

export function parseRamiLevyPromotionFile(
  xmlData: Buffer | string,
  filename = '',
): ParsedPromotionFile {
  const document = parsePromotionXmlDocument<RamiLevyPromotionDocument>(xmlData);
  const root = document.Root;

  if (!root) {
    throw new Error('[PROMO_PARSE] Rami Levy promotion file is missing Root');
  }

  const promotions = ensureArray(root.Promotions?.Promotion)
    .map(normalizePromotion)
    .filter((promotion): promotion is ParsedPromotionRecord => promotion !== null);

  return {
    storeId: coerceString(root.StoreId) ?? extractStoreIdFromFilename(filename),
    promotions,
  };
}
