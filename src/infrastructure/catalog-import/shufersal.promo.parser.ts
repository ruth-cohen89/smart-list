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

interface ShufersalPromotionItemNode {
  ItemCode?: number | string;
  ItemType?: number | string;
  IsGiftItem?: number | string;
  // Shufersal places discount fields on PromotionItem level
  RewardType?: number | string;
  MinQty?: number | string;
  MaxQty?: number | string;
  DiscountRate?: number | string;
  DiscountedPrice?: number | string;
  DiscountedPricePerMida?: number | string;
}

interface ShufersalPromotionNode {
  PromotionId?: number | string;
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
  MinNoOfItemOfered?: number | string;
  AllowMultipleDiscounts?: number | string;
  MinPurchaseAmount?: number | string;
  IsWeightedPromo?: number | string;
  ClubId?: number | string;
  Clubs?: number | string;
  Remarks?: string;
  IsGift?: number | string;
  IsCoupon?: number | string;
  IsTotal?: number | string;
  PromotionItems?: {
    Item?: ShufersalPromotionItemNode | ShufersalPromotionItemNode[];
  };
  // Shufersal-specific datetime fields (instead of separate date + hour)
  PromotionStartDateTime?: string;
  PromotionEndDateTime?: string;
  // Shufersal uses MinNoOfItemOffered (no trailing 's'), AdditionalIsCoupon, ClubID
  MinNoOfItemOffered?: number | string;
  AdditionalIsCoupon?: number | string;
  ClubID?: number | string;
  Groups?: {
    Group?:
      | {
          DiscountType?: number | string;
          MinPurchaseAmount?: number | string;
          PromotionItems?: {
            PromotionItem?: ShufersalPromotionItemNode | ShufersalPromotionItemNode[];
          };
        }
      | {
          DiscountType?: number | string;
          MinPurchaseAmount?: number | string;
          PromotionItems?: {
            PromotionItem?: ShufersalPromotionItemNode | ShufersalPromotionItemNode[];
          };
        }[];
  };
}

interface ShufersalPromotionRootNode {
  StoreId?: number | string;
  StoreID?: number | string;
  Promotions?: {
    Promotion?: ShufersalPromotionNode | ShufersalPromotionNode[];
    Sale?: ShufersalPromotionNode | ShufersalPromotionNode[];
  };
  // Some Shufersal files place promotions directly under Root
  Promotion?: ShufersalPromotionNode | ShufersalPromotionNode[];
  Sale?: ShufersalPromotionNode | ShufersalPromotionNode[];
}

interface ShufersalPromotionDocument {
  Root?: ShufersalPromotionRootNode;
  root?: ShufersalPromotionRootNode;
}

function parsePromotionItems(
  value: ShufersalPromotionNode['PromotionItems'],
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

function parseItemsFromGroups(
  groups: ShufersalPromotionNode['Groups'],
): ParsedPromotionItem[] {
  const items: ParsedPromotionItem[] = [];

  for (const group of ensureArray(groups?.Group)) {
    for (const item of ensureArray(group.PromotionItems?.PromotionItem)) {
      const itemCode = coerceString(item.ItemCode);
      if (!itemCode) continue;
      items.push({
        itemCode,
        itemType: coerceNumber(item.ItemType),
        isGiftItem: coerceBoolean(item.IsGiftItem),
      });
    }
  }

  return items;
}

function normalizePromotion(node: ShufersalPromotionNode): ParsedPromotionRecord | null {
  const promotionId = coerceString(node.PromotionId ?? node.PromotionID);
  if (!promotionId) {
    return null;
  }

  // Shufersal uses PromotionStartDateTime / PromotionEndDateTime — extract date part only
  const startDate =
    coerceString(node.PromotionStartDate) ??
    coerceString(node.PromotionStartDateTime)?.split('T')[0];
  const endDate =
    coerceString(node.PromotionEndDate) ??
    coerceString(node.PromotionEndDateTime)?.split('T')[0];

  // Shufersal places discount/reward fields on Groups.Group (discountType) and
  // Groups.Group.PromotionItems.PromotionItem (discountRate, rewardType, minQty, etc.)
  const firstGroup = node.Groups ? ensureArray(node.Groups.Group)[0] : undefined;
  const firstItem = firstGroup ? ensureArray(firstGroup.PromotionItems?.PromotionItem)[0] : undefined;

  return {
    promotionId,
    description: coerceString(node.PromotionDescription) ?? '',
    promotionUpdateDate: coerceString(node.PromotionUpdateDate),
    startDate,
    startHour: coerceString(node.PromotionStartHour),
    endDate,
    endHour: coerceString(node.PromotionEndHour),
    rewardType: coerceNumber(node.RewardType ?? firstItem?.RewardType),
    discountType: coerceNumber(node.DiscountType ?? firstGroup?.DiscountType),
    discountRate: coerceNumber(node.DiscountRate ?? firstItem?.DiscountRate),
    minQty: coerceNumber(node.MinQty ?? firstItem?.MinQty),
    maxQty: coerceNumber(node.MaxQty ?? firstItem?.MaxQty),
    discountedPrice: coerceNumber(node.DiscountedPrice ?? firstItem?.DiscountedPrice),
    minItemsOffered: coerceNumber(
      node.MinNoOfItemsOffered ?? node.MinNoOfItemOfered ?? node.MinNoOfItemOffered,
    ),
    items: node.Groups ? parseItemsFromGroups(node.Groups) : parsePromotionItems(node.PromotionItems),
    rawPayload: { ...node },
    discountedPricePerMida: coerceNumber(node.DiscountedPricePerMida ?? firstItem?.DiscountedPricePerMida),
    allowMultipleDiscounts: coerceBoolean(node.AllowMultipleDiscounts),
    minPurchaseAmount: coerceNumber(node.MinPurchaseAmount ?? firstGroup?.MinPurchaseAmount),
    isWeightedPromo: coerceBoolean(node.IsWeightedPromo),
    clubId: coerceString(node.ClubId ?? node.ClubID ?? node.Clubs),
    remarks: coerceString(node.Remarks),
    isGift: coerceBoolean(node.IsGift),
    isCoupon: coerceBoolean(node.IsCoupon ?? node.AdditionalIsCoupon),
    isTotal: coerceBoolean(node.IsTotal),
  };
}

export function parseShufersalPromotionFile(
  xmlData: Buffer | string,
  filename = '',
): ParsedPromotionFile {
  const document = parsePromotionXmlDocument<ShufersalPromotionDocument>(xmlData);
  console.log('[PROMO_PARSE] Shufersal top-level keys:', Object.keys(document));
  const root = document.Root ?? document.root;

  if (!root) {
    throw new Error('[PROMO_PARSE] Shufersal promotion file is missing root');
  }

  console.log('[PROMO_PARSE] Shufersal root keys:', Object.keys(root));
  console.log('[PROMO_PARSE] Shufersal root sample:', JSON.stringify(root, null, 2).slice(0, 1000));

  const promotionNodes =
    ensureArray((root as any).Promotions?.Promotion).length > 0
      ? ensureArray((root as any).Promotions?.Promotion)
      : ensureArray((root as any).Promotions?.Sale).length > 0
        ? ensureArray((root as any).Promotions?.Sale)
        : ensureArray((root as any).Promotion).length > 0
          ? ensureArray((root as any).Promotion)
          : ensureArray((root as any).Sale);

  console.log('[PROMO_PARSE] Shufersal raw promotion node count:', promotionNodes.length);

  const promotions = promotionNodes
    .map(normalizePromotion)
    .filter((promotion): promotion is ParsedPromotionRecord => promotion !== null);

  return {
    storeId: coerceString(root.StoreId ?? root.StoreID) ?? extractStoreIdFromFilename(filename),
    promotions,
  };
}
