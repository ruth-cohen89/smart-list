import type { ChainId } from '../models/chain-product.model';
import { normalizeName } from '../utils/normalize';

// Maps canonicalKey → chainId → allowed normalizedName values from the chain's DB.
// Produce items use ONLY this map. If a key/chain pair is absent → null (no match).
// Add entries using the exact normalizedName values as they appear in the chain's DB.
const RAW_MAP: Record<string, Partial<Record<ChainId, string[]>>> = {};

// Pre-normalize all values at module load so comparisons are safe.
export const PRODUCE_CHAIN_EXACT_MAP: Record<string, Partial<Record<ChainId, Set<string>>>> =
  Object.fromEntries(
    Object.entries(RAW_MAP).map(([key, chainMap]) => [
      key,
      Object.fromEntries(
        (Object.entries(chainMap) as [ChainId, string[]][]).map(([chainId, names]) => [
          chainId,
          new Set(names.map(normalizeName)),
        ]),
      ),
    ]),
  );
