import { ChainProductRepository } from '../repositories/chain-product.repository';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';
import type { ChainId } from '../models/chain-product.model';
import { decompressIfNeeded } from '../infrastructure/catalog-import/chain-source.client';
import { parsePriceXml } from '../infrastructure/catalog-import/price-file.parser';
import { normalizeName } from '../utils/normalize';
import { ramiLevyProvider } from '../infrastructure/catalog-import/providers/rami-levy.provider';
import { osherAdProvider } from '../infrastructure/catalog-import/providers/osher-ad.provider';
import { ShufersalProvider } from '../infrastructure/catalog-import/providers/shufersal.provider';

// Result types

export interface ChainImportResult {
  chainId: ChainId;
  success: boolean;
  /** Number of products upserted into ChainProduct. */
  upsertedCount: number;
  /** Filename that was downloaded and parsed. null when no file was found. */
  sourceFile: string | null;
  /** Present when success is false. */
  error?: string;
}

// ─── Provider registry ────────────────────────────────────────────────────────

interface CatalogProvider {
  getLatestFile(): Promise<{ filename: string; rawData: Buffer } | null>;
}

const PROVIDERS: Record<ChainId, CatalogProvider> = {
  'rami-levy': ramiLevyProvider,
  'osher-ad': osherAdProvider,
  shufersal: new ShufersalProvider(),
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class CatalogImportService {
  constructor(private readonly chainProductRepo: ChainProductRepository) {}

  /**
   * Run the full import pipeline for a single chain:
   *  1. Provider fetches, filters, and downloads the latest PriceFull file
   *  2. Decompress
   *  3. Parse XML → products
   *  4. Upsert each product into ChainProduct
   */
  async importChain(chainId: ChainId): Promise<ChainImportResult> {
    console.log(`[IMPORT] chainId: ${chainId}`);
    const provider = PROVIDERS[chainId];
    const file = await provider.getLatestFile();

    if (!file) {
      return {
        chainId,
        success: false,
        upsertedCount: 0,
        sourceFile: null,
        error: `No PriceFull file found for chain: ${chainId}`,
      };
    }

    console.log(`[IMPORT] downloaded file: ${file.filename}`);
    console.log(`[IMPORT] compressed size: ${file.rawData.length} bytes`);

    const xmlData = await decompressIfNeeded(file.rawData);
    console.log(`[IMPORT] decompressed size: ${xmlData.length} bytes`);
    console.log(`[IMPORT] content preview: ${xmlData.subarray(0, 300).toString('utf-8')}`);

    const products = parsePriceXml(xmlData);
    console.log(`[IMPORT] parsed products: ${products.length}`);
    if (products.length > 0) console.log(`[IMPORT] first product: ${JSON.stringify(products[0])}`);

    if (products.length === 0) {
      return {
        chainId,
        success: false,
        upsertedCount: 0,
        sourceFile: file.filename,
        error: 'Parser returned 0 products',
      };
    }

    const now = new Date();
    let upsertedCount = 0;

    for (const p of products) {
      await this.chainProductRepo.upsertProduct({
        chainId,
        externalId: p.itemCode,
        barcode: p.itemCode,
        originalName: p.itemName,
        normalizedName: normalizeName(p.itemName),
        price: p.itemPrice,
        quantity: p.quantity,
        unit: p.unitOfMeasure,
        lastSeenAt: now,
      });
      upsertedCount++;
    }

    return {
      chainId,
      success: true,
      upsertedCount,
      sourceFile: file.filename,
    };
  }

  /**
   * Run the import pipeline for all supported chains sequentially.
   * A single chain failure does not abort the others.
   */
  async importAllChains(): Promise<ChainImportResult[]> {
    const results: ChainImportResult[] = [];

    for (const chainId of SUPPORTED_CHAINS) {
      try {
        const result = await this.importChain(chainId);
        results.push(result);
      } catch (err) {
        results.push({
          chainId,
          success: false,
          upsertedCount: 0,
          sourceFile: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }
}
