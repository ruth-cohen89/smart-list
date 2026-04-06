import type { ChainId } from '../../models/chain-product.model';

/**
 * Reference configuration for each supported chain.
 * NOTE: This config is currently informational — each provider constructs its own
 * request parameters internally. Keep values here in sync with the provider constants.
 */
export interface ChainImportConfig {
  chainId: ChainId;
  /** URL that lists available price files (HTML directory page or custom endpoint). */
  listingUrl: string;
  /**
   * Branch / store ID used to filter file names.
   * Israeli price file names embed the store ID: PriceFull{chainCode}-{storeId}-{ts}.xml.gz
   * For Shufersal:       413 (online / representative branch)
   * For Rami Levy:       039 (online branch)
   * For Machsanei Hashuk: 97 (online store)
   */
  targetStoreId: string;
  /** File-type prefix to import. Only PriceFull for MVP. */
  fileTypePrefix: 'PriceFull';
}

export const CHAIN_IMPORT_CONFIGS: Record<ChainId, ChainImportConfig> = {
  shufersal: {
    chainId: 'shufersal',
    // catID=2 = PriceFull category on prices.shufersal.co.il (matches ShufersalProvider constant)
    listingUrl: 'https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=2&storeId=413',
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
