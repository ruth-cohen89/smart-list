import { ChainProductRepository } from '../repositories/chain-product.repository';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';
import type { ChainId } from '../models/chain-product.model';
import { CHAIN_IMPORT_CONFIGS } from '../infrastructure/catalog-import/chain-import.config';
import {
  fetchListingPage,
  parseFileLinks,
  filterFiles,
  pickLatestFile,
  downloadFile,
  decompressIfNeeded,
} from '../infrastructure/catalog-import/chain-source.client';
import { parsePriceXml } from '../infrastructure/catalog-import/price-file.parser';
import { normalizeName } from '../utils/normalize';

// ─── Result types ─────────────────────────────────────────────────────────────

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

// ─── Service ─────────────────────────────────────────────────────────────────

export class CatalogImportService {
  constructor(private readonly chainProductRepo: ChainProductRepository) {}

  /**
   * Run the full import pipeline for a single chain:
   *  1. Fetch file listing page
   *  2. Filter links → PriceFull files for the target branch
   *  3. Pick the latest file
   *  4. Download + decompress
   *  5. Parse XML → products
   *  6. Upsert each product into ChainProduct (activate + update lastSeenAt)
   */
  async importChain(chainId: ChainId): Promise<ChainImportResult> {
    const config = CHAIN_IMPORT_CONFIGS[chainId];
    const now = new Date();

    // 1. Fetch file listing
    const listingHtml = await fetchListingPage(config.listingUrl);

    // 2. Filter: PriceFull files for the target store
    const allLinks = parseFileLinks(listingHtml, config.listingUrl);
    const filtered = filterFiles(allLinks, config.fileTypePrefix, config.targetStoreId);
    const latest = pickLatestFile(filtered);

    if (!latest) {
      return {
        chainId,
        success: false,
        upsertedCount: 0,
        sourceFile: null,
        error: `No ${config.fileTypePrefix} file found for store ${config.targetStoreId}`,
      };
    }

    // 3. Download + 4. Decompress
    const rawData = await downloadFile(latest.downloadUrl);
    const xmlData = await decompressIfNeeded(rawData);

    // 5. Parse XML
    const products = parsePriceXml(xmlData);

    // 6. Upsert each product
    let upsertedCount = 0;
    for (const p of products) {
      await this.chainProductRepo.upsertProduct({
        chainId,
        externalId: p.itemCode,
        // ItemCode in Israeli price files is the EAN barcode
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
      sourceFile: latest.filename,
    };
  }

  /**
   * Run the import pipeline for all supported chains sequentially.
   * Chains run one after another (not in parallel) to avoid hammering chain servers.
   * A single chain failure does not abort the others.
   *
   * This method is the entry point for the future Cloud Run scheduled job.
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
