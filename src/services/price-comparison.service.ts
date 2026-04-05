import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { ChainProductRepository } from '../repositories/chain-product.repository';
import { normalizeName } from '../utils/normalize';
import type { ShoppingItem } from '../models/shopping-list.model';
import type { ChainProduct, ChainId } from '../models/chain-product.model';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export type MatchSource = 'barcode' | 'name';

export interface MatchedBasketItem {
  shoppingItemId: string;
  shoppingItemName: string;
  /** Quantity from the shopping list — used to calculate the line total. */
  itemQuantity: number;
  product: ChainProduct;
  matchSource: MatchSource;
  /** 0–1 token-overlap score; always 1 for barcode matches. */
  score: number;
  /** True when two candidates scored very closely — frontend can surface a warning. */
  isAmbiguous: boolean;
}

export interface UnmatchedBasketItem {
  shoppingItemId: string;
  shoppingItemName: string;
}

export interface ChainBasket {
  chainId: ChainId;
  /** Sum of (matched product price × shopping list item quantity). */
  totalPrice: number;
  matchedItems: MatchedBasketItem[];
  unmatchedItems: UnmatchedBasketItem[];
}

export interface ComparisonResult {
  chains: ChainBasket[];
  /** Chain with the lowest totalPrice among chains that matched at least one item. */
  cheapestChainId: ChainId | null;
  comparedAt: Date;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Minimum token-overlap score to consider a name match valid. */
const MATCH_THRESHOLD = 0.5;

/** If the top two candidates are within this gap, flag the result as ambiguous. */
const AMBIGUOUS_GAP = 0.1;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PriceComparisonService {
  constructor(
    private readonly shoppingListRepo: ShoppingListRepository,
    private readonly chainProductRepo: ChainProductRepository,
  ) {}

  async compareActiveList(userId: string): Promise<ComparisonResult> {
    const activeList = await this.shoppingListRepo.getOrCreateActiveList(userId);
    console.log(`[COMPARE] userId=${userId} listItems=${activeList.items.length}`);

    // Run all chains in parallel — each chain's matching is independent
    const chains = await Promise.all(
      SUPPORTED_CHAINS.map((chainId) => this.buildChainBasket(chainId, activeList.items)),
    );

    chains.forEach((c) =>
      console.log(
        `[COMPARE] chain=${c.chainId} matched=${c.matchedItems.length} unmatched=${c.unmatchedItems.length} total=${c.matchedItems.length + c.unmatchedItems.length}`,
      ),
    );

    const cheapestChainId = pickCheapestChain(chains);
    return { chains, cheapestChainId, comparedAt: new Date() };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async buildChainBasket(chainId: ChainId, items: ShoppingItem[]): Promise<ChainBasket> {
    const matchedItems: MatchedBasketItem[] = [];
    const unmatchedItems: UnmatchedBasketItem[] = [];

    // Match items sequentially within a chain to avoid thundering-herd DB pressure.
    // If the catalog grows large enough this can be parallelised later.
    for (const item of items) {
      const result = await this.matchItemToChain(item, chainId);
      if (result) {
        matchedItems.push(result);
      } else {
        unmatchedItems.push({ shoppingItemId: item.id, shoppingItemName: item.name });
      }
    }

    const totalPrice = matchedItems.reduce((sum, m) => sum + m.product.price * m.itemQuantity, 0);

    return { chainId, totalPrice, matchedItems, unmatchedItems };
  }

  private async matchItemToChain(
    item: ShoppingItem,
    chainId: ChainId,
  ): Promise<MatchedBasketItem | null> {
    // Step 1 — barcode-first; pick cheapest if multiple records share the same barcode
    if (item.barcode) {
      const barcodeMatches = await this.chainProductRepo.findByBarcode(item.barcode, chainId);
      if (barcodeMatches.length > 0) {
        const cheapest = barcodeMatches.reduce((a, b) => (b.price < a.price ? b : a));
        return {
          shoppingItemId: item.id,
          shoppingItemName: item.name,
          itemQuantity: item.quantity,
          product: cheapest,
          matchSource: 'barcode',
          score: 1,
          isAmbiguous: false,
        };
      }
    }

    // Step 2 — name matching
    return this.matchByName(item, chainId);
  }

  private async matchByName(
    item: ShoppingItem,
    chainId: ChainId,
  ): Promise<MatchedBasketItem | null> {
    const normalizedInput = normalizeName(item.rawName ?? item.name);
    const candidates = await this.chainProductRepo.findCandidatesByName(normalizedInput, chainId);

    if (candidates.length === 0) return null;

    const scored = candidates
      .map((p) => ({ product: p, score: tokenOverlapScore(normalizedInput, p.normalizedName) }))
      .filter((c) => c.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return null;

    const best = scored[0];
    const second = scored[1];
    const isAmbiguous = second !== undefined && best.score - second.score < AMBIGUOUS_GAP;

    return {
      shoppingItemId: item.id,
      shoppingItemName: item.name,
      itemQuantity: item.quantity,
      product: best.product,
      matchSource: 'name',
      score: best.score,
      isAmbiguous,
    };
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Token-overlap score: intersection size / max(|A|, |B|).
 * Ranges 0–1. Simple and interpretable.
 */
function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }

  return intersection / Math.max(ta.size, tb.size);
}

/**
 * Return the chainId with the lowest totalPrice, restricted to chains
 * that matched at least one item (so an empty basket doesn't "win").
 */
function pickCheapestChain(chains: ChainBasket[]): ChainId | null {
  const withMatches = chains.filter((c) => c.matchedItems.length > 0);
  if (withMatches.length === 0) return null;

  return withMatches.reduce((cheapest, c) => (c.totalPrice < cheapest.totalPrice ? c : cheapest))
    .chainId;
}
