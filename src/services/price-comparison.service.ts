import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { ChainProductRepository } from '../repositories/chain-product.repository';
import { normalizeName } from '../utils/normalize';
import { computeBestEffectivePrice } from './effective-price.service';
import type { ShoppingItem } from '../models/shopping-list.model';
import type { ChainProduct, ChainId } from '../models/chain-product.model';
import type { NormalizedPromotion } from '../models/promotion.model';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';

export type MatchSource = 'barcode' | 'name';

export interface MatchedBasketItem {
  shoppingItemId: string;
  shoppingItemName: string;
  itemQuantity: number;
  product: ChainProduct;
  matchSource: MatchSource;
  score: number;
  isAmbiguous: boolean;
  regularTotalPrice: number;
  effectiveTotalPrice: number;
  effectiveUnitPrice: number;
  appliedPromotion: NormalizedPromotion | null;
}

export interface UnmatchedBasketItem {
  shoppingItemId: string;
  shoppingItemName: string;
}

export interface ChainBasket {
  chainId: ChainId;
  totalPrice: number;
  matchedItems: MatchedBasketItem[];
  unmatchedItems: UnmatchedBasketItem[];
}

export interface ComparisonResult {
  chains: ChainBasket[];
  cheapestChainId: ChainId | null;
  comparedAt: Date;
}

const MATCH_THRESHOLD = 0.5;
const AMBIGUOUS_GAP = 0.1;

export class PriceComparisonService {
  constructor(
    private readonly shoppingListRepo: ShoppingListRepository,
    private readonly chainProductRepo: ChainProductRepository,
  ) {}

  async compareActiveList(userId: string): Promise<ComparisonResult> {
    const activeList = await this.shoppingListRepo.getOrCreateActiveList(userId);
    console.log(`[COMPARE] userId=${userId} listItems=${activeList.items.length}`);

    const chains = await Promise.all(
      SUPPORTED_CHAINS.map((chainId) => this.buildChainBasket(chainId, activeList.items)),
    );

    chains.forEach((chain) =>
      console.log(
        `[COMPARE] chain=${chain.chainId} matched=${chain.matchedItems.length} unmatched=${chain.unmatchedItems.length} totalPrice=${chain.totalPrice}`,
      ),
    );

    const cheapestChainId = pickCheapestChain(chains);
    return { chains, cheapestChainId, comparedAt: new Date() };
  }

  private async buildChainBasket(chainId: ChainId, items: ShoppingItem[]): Promise<ChainBasket> {
    const matchedItems: MatchedBasketItem[] = [];
    const unmatchedItems: UnmatchedBasketItem[] = [];

    for (const item of items) {
      const result = await this.matchItemToChain(item, chainId);
      if (result) {
        const effectivePrice = computeBestEffectivePrice(result.product, item.quantity);
        if (effectivePrice.appliedPromotion) {
          console.log(
            `[COMPARE] active promo applied chainId=${chainId} itemCode=${result.product.externalId} promotionId=${effectivePrice.appliedPromotion.promotionId} quantity=${item.quantity} total=${effectivePrice.effectiveTotalPrice}`,
          );
        }

        matchedItems.push({
          ...result,
          regularTotalPrice: effectivePrice.regularTotalPrice,
          effectiveTotalPrice: effectivePrice.effectiveTotalPrice,
          effectiveUnitPrice: effectivePrice.effectiveUnitPrice,
          appliedPromotion: effectivePrice.appliedPromotion,
        });
      } else {
        unmatchedItems.push({ shoppingItemId: item.id, shoppingItemName: item.name });
      }
    }

    const totalPrice = matchedItems.reduce((sum, item) => sum + item.effectiveTotalPrice, 0);
    return { chainId, totalPrice, matchedItems, unmatchedItems };
  }

  private async matchItemToChain(
    item: ShoppingItem,
    chainId: ChainId,
  ): Promise<Omit<MatchedBasketItem, 'regularTotalPrice' | 'effectiveTotalPrice' | 'effectiveUnitPrice' | 'appliedPromotion'> | null> {
    if (item.barcode) {
      const barcodeMatches = await this.chainProductRepo.findByBarcode(item.barcode, chainId);
      if (barcodeMatches.length > 0) {
        const cheapest = barcodeMatches.reduce((current, candidate) =>
          candidate.price < current.price ? candidate : current,
        );

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

    return this.matchByName(item, chainId);
  }

  private async matchByName(
    item: ShoppingItem,
    chainId: ChainId,
  ): Promise<Omit<MatchedBasketItem, 'regularTotalPrice' | 'effectiveTotalPrice' | 'effectiveUnitPrice' | 'appliedPromotion'> | null> {
    const normalizedInput = normalizeName(item.rawName ?? item.name);
    const candidates = await this.chainProductRepo.findCandidatesByName(normalizedInput, chainId);

    if (candidates.length === 0) {
      return null;
    }

    const scoredCandidates = candidates
      .map((product) => ({
        product,
        score: tokenOverlapScore(normalizedInput, product.normalizedName),
      }))
      .filter((candidate) => candidate.score >= MATCH_THRESHOLD)
      .sort((left, right) => right.score - left.score);

    if (scoredCandidates.length === 0) {
      return null;
    }

    const best = scoredCandidates[0];
    const second = scoredCandidates[1];
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

function tokenOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection++;
    }
  }

  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function pickCheapestChain(chains: ChainBasket[]): ChainId | null {
  const withMatches = chains.filter((chain) => chain.matchedItems.length > 0);
  if (withMatches.length === 0) {
    return null;
  }

  return withMatches.reduce((current, candidate) =>
    candidate.totalPrice < current.totalPrice ? candidate : current,
  ).chainId;
}
