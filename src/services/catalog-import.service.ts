import { ChainProductRepository } from '../repositories/chain-product.repository';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';
import type { ChainId } from '../models/chain-product.model';
import { decompressIfNeeded } from '../infrastructure/catalog-import/chain-source.client';
import { parsePriceXml } from '../infrastructure/catalog-import/price-file.parser';
import { normalizeName } from '../utils/normalize';
import { ramiLevyProvider } from '../infrastructure/catalog-import/providers/rami-levy.provider';
import { machsaneiHashukProvider } from '../infrastructure/catalog-import/providers/machsanei-hashuk.provider';
import { ShufersalProvider } from '../infrastructure/catalog-import/providers/shufersal.provider';
import { tivTaamProvider } from '../infrastructure/catalog-import/providers/tiv-taam.provider';
import { ProductResolutionService } from './product-resolution.service';

export interface ChainImportResult {
  chainId: ChainId;
  success: boolean;
  upsertedCount: number;
  skippedCount: number;
  inactiveMarked: number;
  sourceFile: string | null;
  error?: string;
}

interface CatalogProvider {
  getLatestFile(): Promise<{ filename: string; rawData: Buffer } | null>;
  // When false, the provider returns a partial (e.g. store-scoped) snapshot and
  // chain-wide inactive marking must be skipped to avoid false deactivations.
  readonly supportsChainWideInactive?: boolean;
}

const PROVIDERS: Record<ChainId, CatalogProvider> = {
  'rami-levy': ramiLevyProvider,
  'machsanei-hashuk': machsaneiHashukProvider,
  shufersal: new ShufersalProvider(),
  'tiv-taam': tivTaamProvider,
};

export class CatalogImportService {
  constructor(
    private readonly chainProductRepo: ChainProductRepository,
    private readonly productResolution: ProductResolutionService,
  ) {}

  async importChain(chainId: ChainId): Promise<ChainImportResult> {
    console.log(`[IMPORT] chainId=${chainId} starting price import`);

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

    console.log(`[IMPORT] chainId=${chainId} parsedProducts=${products.length}`);

    const now = new Date();
    const seenExternalIds: string[] = [];
    let upsertedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      try {
        if (!product.itemCode || !product.itemName || Number.isNaN(product.itemPrice) || product.itemPrice < 0) {
          skippedCount++;
          continue;
        }

        const normalizedName = normalizeName(product.itemName);
        if (!normalizedName) {
          skippedCount++;
          console.warn(
            `[IMPORT] skipped product chainId=${chainId} itemCode=${product.itemCode} reason=empty-normalized-name`,
          );
          continue;
        }

        // Resolve to a global Product (packaged by barcode, produce by catalog)
        const resolved = await this.productResolution.resolve(product);

        // Future image enrichment: the current chain XML feeds do not include
        // product image URLs. When a source is added that provides images (e.g.
        // a retailer API or scraper), extract the URL here and pass it as
        // imageUrl to upsertProduct. Example:
        //   const imageUrl = product.imageUrl ?? undefined;

        await this.chainProductRepo.upsertProduct({
          chainId,
          externalId: product.itemCode,
          barcode: product.barcode,
          originalName: product.itemName,
          normalizedName,
          price: product.itemPrice,
          quantity: product.quantity,
          unit: product.unitOfMeasure,
          isWeighted: product.isWeighted,
          lastSeenAt: now,
          productId: resolved?.product.id,
          productType: resolved?.productType,
          // imageUrl,  // uncomment when source provides images
        });

        seenExternalIds.push(product.itemCode);
        upsertedCount++;
      } catch (error) {
        skippedCount++;
        console.error(
          `[IMPORT] skipped product chainId=${chainId} itemCode=${product.itemCode} error=${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const inactiveMarked =
      provider.supportsChainWideInactive !== false
        ? await this.chainProductRepo.markInactiveExcept(chainId, seenExternalIds)
        : 0;

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
      } catch (error) {
        results.push({
          chainId,
          success: false,
          upsertedCount: 0,
          skippedCount: 0,
          inactiveMarked: 0,
          sourceFile: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  async verifyImport(chainId: ChainId): Promise<void> {
    await this.chainProductRepo.verifyImport(chainId);
  }
}
