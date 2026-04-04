import { normalizeName } from '../utils/normalize';
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
        score: this.scoreProduct(product, inputTokens, normalizedInput, itemCategory),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private scoreProduct(
    product: ProductEntry,
    inputTokens: Set<string>,
    normalizedInput: string,
    itemCategory?: string,
  ): number {
    const productTokens = tokenSet(product.normalizedName);

    // Jaccard over word tokens (primary signal)
    const tokenScore = jaccardSets(inputTokens, productTokens);

    // Bigram character similarity (fuzzy fallback for partial / misspelled input)
    const charScore = jaccardCharNgrams(normalizedInput, product.normalizedName, 2);

    // When token overlap is strong, trust it; otherwise fall back to char similarity
    let score = tokenScore >= 0.5 ? tokenScore : Math.max(tokenScore, charScore * 0.8);

    // Small category bonus — not a hard gate, just a tiebreaker
    if (
      itemCategory &&
      product.category &&
      normalizeName(itemCategory) === normalizeName(product.category)
    ) {
      score = Math.min(1, score + 0.05);
    }

    return score;
  }
}

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

function tokenSet(str: string): Set<string> {
  return new Set(str.split(' ').filter(Boolean));
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

function jaccardCharNgrams(a: string, b: string, n: number): number {
  const aNgrams = charNgramSet(a, n);
  const bNgrams = charNgramSet(b, n);
  if (aNgrams.size === 0 && bNgrams.size === 0) return 1;
  if (aNgrams.size === 0 || bNgrams.size === 0) return 0;
  let intersection = 0;
  for (const ng of aNgrams) {
    if (bNgrams.has(ng)) intersection++;
  }
  return intersection / (aNgrams.size + bNgrams.size - intersection);
}

function charNgramSet(str: string, n: number): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i <= str.length - n; i++) {
    result.add(str.slice(i, i + n));
  }
  return result;
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
