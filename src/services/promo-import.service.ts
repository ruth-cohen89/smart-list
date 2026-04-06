import { PromotionRepository } from '../repositories/promotion.repository';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';
import type { ChainId } from '../models/chain-product.model';
import { decompressIfNeeded } from '../infrastructure/catalog-import/chain-source.client';
import { parsePromoXml } from '../infrastructure/catalog-import/promo-file.parser';
import { ramiLevyPromoProvider } from '../infrastructure/catalog-import/providers/rami-levy-promo.provider';
import { machsaneiHashukPromoProvider } from '../infrastructure/catalog-import/providers/machsanei-hashuk.provider';
import { ShufersalPromoProvider } from '../infrastructure/catalog-import/providers/shufersal-promo.provider';

// Result types

export interface ChainPromoImportResult {
  chainId: ChainId;
  success: boolean;
  upsertedCount: number;
  skippedCount: number;
  inactiveMarked: number;
  sourceFile: string | null;
  error?: string;
}

// ─── Provider registry ────────────────────────────────────────────────────────

interface PromoProvider {
  getLatestFile(): Promise<{ filename: string; rawData: Buffer } | null>;
}

const PROMO_PROVIDERS: Record<ChainId, PromoProvider> = {
  'rami-levy': ramiLevyPromoProvider,
  'machsanei-hashuk': machsaneiHashukPromoProvider,
  shufersal: new ShufersalPromoProvider(),
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class PromoImportService {
  constructor(private readonly promoRepo: PromotionRepository) {}

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
        sourceFile: null,
        error: `No PromoFull file found for chain: ${chainId}`,
      };
    }

    const xmlData = await decompressIfNeeded(file.rawData);
    const parsed = parsePromoXml(xmlData, file.filename);

    console.log(
      `[PROMO_IMPORT] chainId=${chainId} storeId=${parsed.storeId} rawPromotions=${parsed.promotions.length}`,
    );
    parsed.promotions
      .slice(0, 3)
      .forEach((p, i) =>
        console.log(
          `[PROMO_IMPORT] sample[${i}] id=${p.promotionId} desc="${p.description}" items=${p.itemCodes.length}`,
        ),
      );

    const now = new Date();
    const seenPromotionIds: string[] = [];
    let upsertedCount = 0;
    let skippedCount = 0;

    for (const p of parsed.promotions) {
      try {
        if (!p.promotionId || !p.description) {
          skippedCount++;
          continue;
        }

        // Combine date + hour strings into Date objects
        const startAt = this.combineDateTime(p.startDate, p.startHour);
        const endAt = this.combineDateTime(p.endDate, p.endHour);

        await this.promoRepo.upsertPromo({
          chainId,
          storeId: parsed.storeId,
          promotionId: p.promotionId,
          description: p.description,
          startAt,
          endAt,
          rewardType: p.rewardType,
          discountType: p.discountType,
          minQty: p.minQty,
          maxQty: p.maxQty,
          discountedPrice: p.discountedPrice,
          discountedPricePerMida: p.discountedPricePerMida,
          discountRate: p.discountRate,
          allowMultipleDiscounts: p.allowMultipleDiscounts,
          clubId: p.clubId,
          isGift: p.isGift,
          isCoupon: p.isCoupon,
          isTotal: p.isTotal,
          itemCodes: p.itemCodes,
          lastSeenAt: now,
        });

        seenPromotionIds.push(p.promotionId);
        upsertedCount++;
      } catch (err) {
        skippedCount++;
        console.error(
          `[PROMO_IMPORT] product error — chainId=${chainId} promotionId=${p.promotionId} error=${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    console.log(
      `[PROMO_IMPORT] chainId=${chainId} upserted=${upsertedCount} skipped=${skippedCount}`,
    );

    const inactiveMarked = await this.promoRepo.markInactiveExcept(
      chainId,
      parsed.storeId,
      seenPromotionIds,
    );
    console.log(`[PROMO_IMPORT] chainId=${chainId} inactiveMarked=${inactiveMarked}`);

    return {
      chainId,
      success: true,
      upsertedCount,
      skippedCount,
      inactiveMarked,
      sourceFile: file.filename,
    };
  }

  async importAllChains(): Promise<ChainPromoImportResult[]> {
    const results: ChainPromoImportResult[] = [];

    for (const chainId of SUPPORTED_CHAINS) {
      try {
        results.push(await this.importChain(chainId));
      } catch (err) {
        results.push({
          chainId,
          success: false,
          upsertedCount: 0,
          skippedCount: 0,
          inactiveMarked: 0,
          sourceFile: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  /** DEV ONLY — verify what is stored in Mongo for a chain after import. */
  async verifyImport(chainId: ChainId): Promise<void> {
    await this.promoRepo.verifyImport(chainId);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Combine a date string (YYYY-MM-DD) and optional hour string (HH:MM) into a Date.
   * Returns null if the date is missing or the resulting Date is invalid.
   */
  private combineDateTime(date?: string, hour?: string): Date | null {
    if (!date) return null;
    const iso = `${date}T${hour ?? '00:00'}:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
}
