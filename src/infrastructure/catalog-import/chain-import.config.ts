import type { ChainId } from '../../models/chain-product.model';

/**
 * Configuration for importing price files from a single supermarket chain.
 * Add new chains by adding an entry here — no structural changes elsewhere required.
 */
export interface ChainImportConfig {
  chainId: ChainId;
  /** URL that lists available price files (HTML directory page or custom endpoint). */
  listingUrl: string;
  /**
   * Branch / store ID used to filter file names.
   * Israeli price file names embed the store ID: PriceFull{chainCode}-{storeId}-{ts}.xml.gz
   * For Shufersal:  413 (online / representative branch)
   * For Rami Levy:  039 (online branch)
   * For Osher Ad:   013 (temporary representative branch for MVP — no explicit online store)
   */
  targetStoreId: string;
  /** File-type prefix to import. Only PriceFull for MVP. */
  fileTypePrefix: 'PriceFull';
}

export const CHAIN_IMPORT_CONFIGS: Record<ChainId, ChainImportConfig> = {
  shufersal: {
    chainId: 'shufersal',
    // The storeId query param pre-filters the listing to this branch; filename filter is applied too.
    listingUrl: 'https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=5&storeId=413',
    targetStoreId: '413',
    fileTypePrefix: 'PriceFull',
  },
  'rami-levy': {
    chainId: 'rami-levy',
    listingUrl: 'http://publishprice.rl.co.il/',
    targetStoreId: '039',
    fileTypePrefix: 'PriceFull',
  },
  'machsanei-hashuk': {
    chainId: 'machsanei-hashuk',
    listingUrl: 'https://laibcatalog.co.il/',
    targetStoreId: '97',
    fileTypePrefix: 'PriceFull',
  },
};
