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

interface TivTaamPromotionItemNode {
  ItemCode?: number | string;
  ItemType?: number | string;
  IsGiftItem?: number | string;
}

interface TivTaamAdditionalRestrictions {
  AdditionalIsCoupon?: number | string;
  AdditionalGiftCount?: number | string;
  AdditionalIsTotal?: number | string;
  AdditionalIsActive?: number | string;
}

interface TivTaamClubs {
  ClubId?: number | string;
  Clubid?: number | string;
}

interface TivTaamPromotionNode {
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
  Remarks?: string;
  AdditionalRestrictions?: TivTaamAdditionalRestrictions;
  Clubs?: TivTaamClubs;
  PromotionItems?: {
    Item?: TivTaamPromotionItemNode | TivTaamPromotionItemNode[];
  };
}

interface TivTaamPromotionDocument {
  // Tiv Taam uses lowercase <root> (unlike Rami Levy's <Root>)
  root?: {
    StoreId?: number | string;
    Promotions?: {
      Promotion?: TivTaamPromotionNode | TivTaamPromotionNode[];
    };
  };
}

function parsePromotionItems(
  value: TivTaamPromotionNode['PromotionItems'],
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

function normalizePromotion(node: TivTaamPromotionNode): ParsedPromotionRecord | null {
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
    // Clubs: <Clubs> may carry multiple entries with inconsistent casing (ClubId / Clubid).
    // Join all present values into a comma-separated string so none are silently dropped.
    clubId:
      [coerceString(node.Clubs?.ClubId), coerceString(node.Clubs?.Clubid)]
        .filter((id): id is string => id !== undefined)
        .join(',') || undefined,
    remarks: coerceString(node.Remarks),
    // AdditionalRestrictions: IsGift/IsCoupon/IsTotal live inside this nested block.
    // The whole block may be absent — all three fields fall back to undefined in that case.
    isGift:
      node.AdditionalRestrictions !== undefined
        ? Number(node.AdditionalRestrictions.AdditionalGiftCount ?? 0) > 0
        : undefined,
    isCoupon: coerceBoolean(node.AdditionalRestrictions?.AdditionalIsCoupon),
    isTotal: coerceBoolean(node.AdditionalRestrictions?.AdditionalIsTotal),
  };
}

export function parseTivTaamPromotionFile(
  xmlData: Buffer | string,
  filename = '',
): ParsedPromotionFile {
  const document = parsePromotionXmlDocument<TivTaamPromotionDocument>(xmlData);
  const root = document.root;

  if (!root) {
    throw new Error('[PROMO_PARSE] Tiv Taam promotion file is missing root');
  }

  const promotions = ensureArray(root.Promotions?.Promotion)
    .map(normalizePromotion)
    .filter((promotion): promotion is ParsedPromotionRecord => promotion !== null);

  return {
    storeId: coerceString(root.StoreId) ?? extractStoreIdFromFilename(filename),
    promotions,
  };
}
