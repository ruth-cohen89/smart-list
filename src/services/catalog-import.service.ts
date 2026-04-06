import { ChainProductRepository } from '../repositories/chain-product.repository';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';
import type { ChainId } from '../models/chain-product.model';
import { decompressIfNeeded } from '../infrastructure/catalog-import/chain-source.client';
import { parsePriceXml } from '../infrastructure/catalog-import/price-file.parser';
import { normalizeName } from '../utils/normalize';
import { ramiLevyProvider } from '../infrastructure/catalog-import/providers/rami-levy.provider';
import { machsaneiHashukProvider } from '../infrastructure/catalog-import/providers/machsanei-hashuk.provider';
import { ShufersalProvider } from '../infrastructure/catalog-import/providers/shufersal.provider';

// Result types

export interface ChainImportResult {
  chainId: ChainId;
  success: boolean;
  upsertedCount: number;
  skippedCount: number;
  inactiveMarked: number;
  sourceFile: string | null;
  error?: string;
}

// ─── Provider registry ────────────────────────────────────────────────────────

interface CatalogProvider {
  getLatestFile(): Promise<{ filename: string; rawData: Buffer } | null>;
}

const PROVIDERS: Record<ChainId, CatalogProvider> = {
  'rami-levy': ramiLevyProvider,
  'machsanei-hashuk': machsaneiHashukProvider,
  shufersal: new ShufersalProvider(),
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class CatalogImportService {
  constructor(private readonly chainProductRepo: ChainProductRepository) {}

  async importChain(chainId: ChainId): Promise<ChainImportResult> {
    console.log(`[IMPORT] chainId=${chainId} starting`);

    const provider = PROVIDERS[chainId];
    const file = await provider.getLatestFile();

    if (!file) {
      return {
        chainId,
        success: false,
        upsertedCount: 0,
        skippedCount: 0,
        inactiveMarked: 0,
        sourceFile: null,
        error: `No PriceFull file found for chain: ${chainId}`,
      };
    }

    const xmlData = await decompressIfNeeded(file.rawData);
    const products = parsePriceXml(xmlData, file.filename);

    console.log(`[IMPORT] chainId=${chainId} parsed=${products.length}`);
    products
      .slice(0, 3)
      .forEach((p, i) =>
        console.log(
          `[IMPORT] sample[${i}] code=${p.itemCode} name="${p.itemName}" price=${p.itemPrice} barcode=${p.barcode ?? '(none)'}`,
        ),
      );

    // ── Validation + upsert loop ─────────────────────────────────────────────
    const now = new Date();
    const seenExternalIds: string[] = [];
    let upsertedCount = 0;
    let skippedCount = 0;

    for (const p of products) {
      try {
        // Lightweight validation — skip records that would fail DB constraints
        if (!p.itemCode || !p.itemName || isNaN(p.itemPrice) || p.itemPrice < 0) {
          skippedCount++;
          continue;
        }

        const normalizedName = normalizeName(p.itemName);
        if (!normalizedName) {
          console.warn(
            `[IMPORT] skip — empty normalizedName chainId=${chainId} itemCode=${p.itemCode} name="${p.itemName}"`,
          );
          skippedCount++;
          continue;
        }

        await this.chainProductRepo.upsertProduct({
          chainId,
          externalId: p.itemCode,
          barcode: p.barcode,
          originalName: p.itemName,
          normalizedName,
          price: p.itemPrice,
          quantity: p.quantity,
          unit: p.unitOfMeasure,
          lastSeenAt: now,
        });

        seenExternalIds.push(p.itemCode);
        upsertedCount++;
      } catch (err) {
        skippedCount++;
        console.error(
          `[IMPORT] product error — chainId=${chainId} itemCode=${p.itemCode} name="${p.itemName}" barcode=${p.barcode ?? '(none)'} price=${p.itemPrice} error=${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    console.log(`[IMPORT] chainId=${chainId} upserted=${upsertedCount} skipped=${skippedCount}`);

    // ── Mark disappeared products inactive ───────────────────────────────────
    const inactiveMarked = await this.chainProductRepo.markInactiveExcept(chainId, seenExternalIds);
    console.log(`[IMPORT] chainId=${chainId} inactiveMarked=${inactiveMarked}`);

    return {
      chainId,
      success: true,
      upsertedCount,
      skippedCount,
      inactiveMarked,
      sourceFile: file.filename,
    };
  }

  async importAllChains(): Promise<ChainImportResult[]> {
    const results: ChainImportResult[] = [];

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
    await this.chainProductRepo.verifyImport(chainId);
  }
}
