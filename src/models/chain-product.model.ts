// Supported supermarket chains.
// Add new values here when onboarding additional chains — no other structural changes required.
export type ChainId = 'shufersal' | 'rami-levy' | 'osher-ad';

export const SUPPORTED_CHAINS: ChainId[] = ['shufersal', 'rami-levy', 'osher-ad'];

/**
 * A normalized product record sourced from a single supermarket chain.
 * Populated and kept up-to-date by an external import job (not live-fetched on user requests).
 */
export interface ChainProduct {
  id: string;
  chainId: ChainId;
  /** Chain's own product identifier — used as the upsert key together with chainId. */
  externalId: string;
  barcode?: string;
  originalName: string;
  normalizedName: string;
  price: number;
  unit?: string;
  /** Package size / quantity as sold (e.g. 1.5 for a 1.5 L bottle). */
  quantity?: number;
  /** False when the product was not seen in the most recent import. Never hard-deleted. */
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Input shape for the upsert operation used by import jobs. */
export interface UpsertChainProductData {
  chainId: ChainId;
  externalId: string;
  barcode?: string;
  originalName: string;
  normalizedName: string;
  price: number;
  unit?: string;
  quantity?: number;
  lastSeenAt: Date;
}
