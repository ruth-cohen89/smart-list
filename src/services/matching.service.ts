import { normalizeName } from '../utils/normalize';
import { tokenSet, scoreProduct as scoreProductShared } from '../utils/scoring';
import type { ShoppingItem, MatchedProduct, MatchStatus } from '../models/shopping-list.model';

// ---------------------------------------------------------------------------
// Product catalog entry — plug in a real catalog later
// ---------------------------------------------------------------------------

export interface ProductEntry {
  productId: string;
  externalProductCode?: string;
  name: string;
  normalizedName: string;
  brand?: string;
  category?: string;
  quantity?: number;
  unit?: string;
}

// ---------------------------------------------------------------------------
// Result returned per item
// ---------------------------------------------------------------------------

export interface MatchResult {
  matchStatus: MatchStatus;
  matchedProduct: MatchedProduct | null;
  confidence: number;
  /** Top candidates sorted by score — available for future ambiguity resolution UI */
  candidates: Array<{ product: ProductEntry; score: number }>;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const HIGH_CONFIDENCE = 0.85;
const AMBIGUOUS_CONFIDENCE = 0.6;
/** If the top-two candidates are within this gap, call it ambiguous */
const AMBIGUOUS_GAP = 0.1;

// ---------------------------------------------------------------------------
// MatchingService
// ---------------------------------------------------------------------------

export class MatchingService {
  /**
   * Inject a product catalog. Defaults to an empty array (MVP: no catalog yet).
   * When a real catalog is available, pass it here or replace with a catalog repo.
   */
  constructor(private readonly catalog: ProductEntry[] = []) {}

  matchShoppingItem(item: ShoppingItem): MatchResult {
    const normalized = normalizeName(item.rawName ?? item.name);

    if (this.catalog.length === 0) {
      return noMatch();
    }

    const candidates = this.scoreCandidates(normalized, item.category);

    if (candidates.length === 0) {
      return noMatch();
    }

    const best = candidates[0];

    if (best.score >= HIGH_CONFIDENCE) {
      const second = candidates[1];
      const isAmbiguous = second !== undefined && best.score - second.score < AMBIGUOUS_GAP;
      return {
        matchStatus: isAmbiguous ? 'ambiguous' : 'matched',
        matchedProduct: toMatchedProduct(best.product, best.score),
        confidence: best.score,
        candidates,
      };
    }

    if (best.score >= AMBIGUOUS_CONFIDENCE) {
      return {
        matchStatus: 'ambiguous',
        matchedProduct: toMatchedProduct(best.product, best.score),
        confidence: best.score,
        candidates,
      };
    }

    return { matchStatus: 'unmatched', matchedProduct: null, confidence: best.score, candidates };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private scoreCandidates(
    normalizedInput: string,
    itemCategory?: string,
  ): Array<{ product: ProductEntry; score: number }> {
    const inputTokens = tokenSet(normalizedInput);

    return this.catalog
      .map((product) => ({
        product,
        score: this.scoreProductEntry(product, inputTokens, normalizedInput, itemCategory),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private scoreProductEntry(
    product: ProductEntry,
    inputTokens: Set<string>,
    normalizedInput: string,
    itemCategory?: string,
  ): number {
    return scoreProductShared({
      inputTokens,
      normalizedInput,
      candidateNormalizedName: product.normalizedName,
      inputCategory: itemCategory,
      candidateCategory: product.category,
    });
  }
}

function toMatchedProduct(product: ProductEntry, confidence: number): MatchedProduct {
  return {
    productId: product.productId,
    externalProductCode: product.externalProductCode,
    name: product.name,
    brand: product.brand,
    category: product.category,
    quantity: product.quantity,
    unit: product.unit,
    confidence,
  };
}

function noMatch(): MatchResult {
  return { matchStatus: 'unmatched', matchedProduct: null, confidence: 0, candidates: [] };
}
