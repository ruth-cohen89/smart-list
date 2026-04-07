import type { NormalizedPromotion } from './promotion.model';

export type ChainId = 'shufersal' | 'rami-levy' | 'machsanei-hashuk';

export const SUPPORTED_CHAINS: ChainId[] = ['shufersal', 'rami-levy', 'machsanei-hashuk'];

export type EmbeddedPromotion = NormalizedPromotion;

export interface ChainProduct {
  id: string;
  chainId: ChainId;
  externalId: string;
  barcode?: string;
  originalName: string;
  normalizedName: string;
  price: number;
  unit?: string;
  quantity?: number;
  isActive: boolean;
  lastSeenAt: Date;
  promotions: NormalizedPromotion[];
  hasActivePromotions: boolean;
  lastPromotionSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
