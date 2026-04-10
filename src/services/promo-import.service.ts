import { PromotionRepository } from '../repositories/promotion.repository';
import { ChainProductRepository } from '../repositories/chain-product.repository';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';
import type { ChainId, ProductPromotionSnapshot } from '../models/chain-product.model';
import { PromotionKind, type Promotion } from '../models/promotion.model';
import type {
  ParsedPromotionFile,
  ParsedPromotionRecord,
} from '../infrastructure/catalog-import/promo-file.parser';
import { parseRamiLevyPromotionFile } from '../infrastructure/catalog-import/rami-levy.promo.parser';
import { parseShufersalPromotionFile } from '../infrastructure/catalog-import/shufersal.promo.parser';
import { parseMahsaneiHashukPromotionFile } from '../infrastructure/catalog-import/mahsanei-hashuk.promo.parser';
import { ramiLevyPromoProvider } from '../infrastructure/catalog-import/providers/rami-levy-promo.provider';
import { machsaneiHashukPromoProvider } from '../infrastructure/catalog-import/providers/machsanei-hashuk.provider';
import { shufersalPromoProvider } from '../infrastructure/catalog-import/providers/shufersal-promo.provider';
import {
  classifyPromotion,
  hasUsablePromotionWindow,
  isPromotionActive,
  parseDate,
} from '../utils/promo-utils';

export interface ChainPromoImportResult {
  chainId: ChainId;
  success: boolean;
  upsertedCount: number;
  skippedCount: number;
  inactiveMarked: number;
  productsUpdated: number;
  sourceFile: string | null;
  error?: string;
}

interface PromoProvider {
  getLatestFile(): Promise<{ filename: string; rawData: Buffer } | null>;
}

const PROMO_PROVIDERS: Record<ChainId, PromoProvider> = {
  'rami-levy': ramiLevyPromoProvider,
  'machsanei-hashuk': machsaneiHashukPromoProvider,
  shufersal: shufersalPromoProvider,
};

function parsePromotionFile(
  chainId: ChainId,
  xmlData: Buffer | string,
  filename: string,
): ParsedPromotionFile {
  switch (chainId) {
    case 'rami-levy':
      return parseRamiLevyPromotionFile(xmlData, filename);
    case 'shufersal':
      return parseShufersalPromotionFile(xmlData, filename);
    case 'machsanei-hashuk':
      return parseMahsaneiHashukPromotionFile(xmlData, filename);
  }
}

function shouldSkipParsedPromotion(record: ParsedPromotionRecord): boolean {
  return !record.promotionId || record.items.length === 0;
}

function toProductPromotionSnapshot(promotion: Promotion): ProductPromotionSnapshot {
  return {
    chainId: promotion.chainId,
    promotionId: promotion.promotionId,
    description: promotion.description,
    startAt: promotion.startAt,
    endAt: promotion.endAt,
    parsedPromotionKind: promotion.parsedPromotionKind,
    discountType: promotion.discountType,
    discountRate: promotion.discountRate,
    discountedPrice: promotion.discountedPrice,
    minQty: promotion.minQty,
    maxQty: promotion.maxQty,
    minItemsOffered: promotion.minItemsOffered,
    discountedPricePerMida: promotion.discountedPricePerMida,
    minPurchaseAmount: promotion.minPurchaseAmount,
    isWeightedPromo: promotion.isWeightedPromo,
    allowMultipleDiscounts: promotion.allowMultipleDiscounts,
    isGift: promotion.isGift,
    isCoupon: promotion.isCoupon,
    isTotal: promotion.isTotal,
    clubId: promotion.clubId,
    remarks: promotion.remarks,
  };
}

export class PromoImportService {
  constructor(
    private readonly promoRepo: PromotionRepository,
    private readonly chainProductRepo: ChainProductRepository,
  ) {}

  async importChain(chainId: ChainId): Promise<ChainPromoImportResult> {
    console.log(`[PROMO_IMPORT] chainId=${chainId} starting`);

    const provider = PROMO_PROVIDERS[chainId];
    const file = await provider.getLatestFile();

    if (!file) {
      return {
        chainId,
        success: false,
        upsertedCount: 0,
        skippedCount: 0,
        inactiveMarked: 0,
        productsUpdated: 0,
        sourceFile: null,
        error: `No PromoFull file found for chain: ${chainId}`,
      };
    }

    const parsedFile = parsePromotionFile(chainId, file.rawData, file.filename);
    console.log(
      `[PROMO_IMPORT] chainId=${chainId} parsedPromotions=${parsedFile.promotions.length} sourceFile=${file.filename}`,
    );

    const now = new Date();
    const seenPromotionIds: string[] = [];
    const batch: import('../models/promotion.model').UpsertPromoData[] = [];
    let skippedCount = 0;

    console.log(`[PROMO_IMPORT] chainId=${chainId} preparing upsert batch...`);

    for (const record of parsedFile.promotions) {
      if (shouldSkipParsedPromotion(record)) {
        skippedCount++;
        continue;
      }

      const startAt = parseDate(record.startDate, record.startHour, 'start');
      const endAt = parseDate(record.endDate, record.endHour, 'end');
      const promotionUpdateAt =
        parseDate(record.promotionUpdateDate, undefined, 'end') ?? undefined;

      const parsedPromotionKind = classifyPromotion({
        discountedPrice: record.discountedPrice,
        minQty: record.minQty,
        minItemsOffered: record.minItemsOffered,
        discountRate: record.discountRate,
        discountType: record.discountType,
        rewardType: record.rewardType,
        isGift: record.isGift,
        items: record.items,
      });

      batch.push({
        chainId,
        storeId: parsedFile.storeId,
        promotionId: record.promotionId,
        description: record.description,
        startAt,
        endAt,
        rewardType: record.rewardType,
        discountType: record.discountType,
        discountRate: record.discountRate,
        minQty: record.minQty,
        maxQty: record.maxQty,
        discountedPrice: record.discountedPrice,
        minItemsOffered: record.minItemsOffered,
        items: record.items,
        parsedPromotionKind,
        rawPayload: record.rawPayload,
        promotionUpdateAt,
        discountedPricePerMida: record.discountedPricePerMida,
        allowMultipleDiscounts: record.allowMultipleDiscounts,
        minPurchaseAmount: record.minPurchaseAmount,
        isWeightedPromo: record.isWeightedPromo,
        clubId: record.clubId,
        remarks: record.remarks,
        isGift: record.isGift,
        isCoupon: record.isCoupon,
        isTotal: record.isTotal,
        lastSeenAt: now,
      });

      seenPromotionIds.push(record.promotionId);
    }

    console.log(
      `[PROMO_IMPORT] chainId=${chainId} batchSize=${batch.length} skipped=${skippedCount}`,
    );

    // Bulk upsert in chunks of 500
    const CHUNK_SIZE = 500;
    let upsertedCount = 0;
    for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
      const chunk = batch.slice(i, i + CHUNK_SIZE);
      const count = await this.promoRepo.bulkUpsertPromos(chunk);
      upsertedCount += count;
      console.log(
        `[PROMO_IMPORT] chainId=${chainId} upserted chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(batch.length / CHUNK_SIZE)} (${count} ops)`,
      );
    }

    console.log(
      `[PROMO_IMPORT] chainId=${chainId} upsertedPromotions=${upsertedCount} skippedPromotions=${skippedCount}`,
    );

    console.log(`[PROMO_IMPORT] chainId=${chainId} markInactiveExcept starting...`);
    const inactiveMarked = await this.promoRepo.markInactiveExcept(
      chainId,
      parsedFile.storeId,
      seenPromotionIds,
    );
    console.log(
      `[PROMO_IMPORT] chainId=${chainId} markInactiveExcept done inactiveMarked=${inactiveMarked}`,
    );

    let productsUpdated = 0;
    try {
      console.log(`[PROMO_IMPORT] chainId=${chainId} mergePromotionsToProducts starting...`);
      productsUpdated = await this.mergePromotionsToProducts(chainId, now);
      console.log(
        `[PROMO_IMPORT] chainId=${chainId} mergePromotionsToProducts done productsUpdated=${productsUpdated}`,
      );
    } catch (error) {
      console.error(
        `[PROMO_IMPORT] merge failed chainId=${chainId} error=${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      chainId,
      success: true,
      upsertedCount,
      skippedCount,
      inactiveMarked,
      productsUpdated,
      sourceFile: file.filename,
    };
  }

  async importAllChains(): Promise<ChainPromoImportResult[]> {
    const results: ChainPromoImportResult[] = [];

    for (const chainId of SUPPORTED_CHAINS) {
      try {
        results.push(await this.importChain(chainId));
      } catch (error) {
        results.push({
          chainId,
          success: false,
          upsertedCount: 0,
          skippedCount: 0,
          inactiveMarked: 0,
          productsUpdated: 0,
          sourceFile: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  async verifyImport(chainId: ChainId): Promise<void> {
    await this.promoRepo.verifyImport(chainId);
  }

  private async mergePromotionsToProducts(chainId: ChainId, now: Date): Promise<number> {
    const activePromotions = await this.promoRepo.findActiveByChain(chainId, now);
    const promotionsByItemCode = new Map<string, ProductPromotionSnapshot[]>();
    let activePromotionsApplied = 0;
    let skippedPromotions = 0;

    for (const promotion of activePromotions) {
      if (!hasUsablePromotionWindow(promotion)) {
        skippedPromotions++;
        continue;
      }

      if (!isPromotionActive(now, promotion.startAt, promotion.endAt)) {
        skippedPromotions++;
        continue;
      }

      if (promotion.parsedPromotionKind === PromotionKind.UNKNOWN) {
        skippedPromotions++;
        continue;
      }

      const snapshot = toProductPromotionSnapshot(promotion);
      for (const item of promotion.items) {
        if (!promotionsByItemCode.has(item.itemCode)) {
          promotionsByItemCode.set(item.itemCode, []);
        }
        promotionsByItemCode.get(item.itemCode)!.push(snapshot);
      }

      activePromotionsApplied++;
    }

    console.log(
      `[PROMO_IMPORT] chainId=${chainId} activePromotionsApplied=${activePromotionsApplied} skippedPromotions=${skippedPromotions} itemCodes=${promotionsByItemCode.size}`,
    );

    const productsUpdated = await this.chainProductRepo.mergePromotions(
      chainId,
      promotionsByItemCode,
      now,
    );

    console.log(`[PROMO_IMPORT] chainId=${chainId} matchedPromotionsToProducts=${productsUpdated}`);

    return productsUpdated;
  }
}
