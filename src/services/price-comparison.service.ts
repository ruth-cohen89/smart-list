import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { ChainProductRepository } from '../repositories/chain-product.repository';
import { normalizeName } from '../utils/normalize';
import { tokenSet, scoreProduct } from '../utils/scoring';
import { computeBestEffectivePrice } from './effective-price.service';
import { matchProduceCanonical } from '../data/produce-catalog';
import { ProductRepository } from '../repositories/product.repository';
import type { ShoppingItem } from '../models/shopping-list.model';
import type { ChainProduct, ChainId, ProductPromotionSnapshot } from '../models/chain-product.model';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';

export type MatchSource = 'product_id' | 'barcode' | 'produce' | 'name' | 'matched_product';

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
  appliedPromotion: ProductPromotionSnapshot | null;
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

// Aligned with matching.service thresholds
const MATCH_THRESHOLD = 0.45;
const AMBIGUOUS_GAP = 0.1;

export class PriceComparisonService {
  constructor(
    private readonly shoppingListRepo: ShoppingListRepository,
    private readonly chainProductRepo: ChainProductRepository,
    private readonly productRepo: ProductRepository,
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
    // 1. productId — highest priority (global product identity)
    if (item.productId) {
      const productIdMatches = await this.chainProductRepo.findByProductId(item.productId, chainId);
      if (productIdMatches.length > 0) {
        const cheapest = productIdMatches.reduce((current, candidate) =>
          candidate.price < current.price ? candidate : current,
        );

        console.log(
          `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=product_id product="${cheapest.originalName}" status=matched`,
        );

        return {
          shoppingItemId: item.id,
          shoppingItemName: item.name,
          itemQuantity: item.quantity,
          product: cheapest,
          matchSource: 'product_id',
          score: 1,
          isAmbiguous: false,
        };
      }
    }

    // 2. Barcode match
    if (item.barcode) {
      const barcodeMatches = await this.chainProductRepo.findByBarcode(item.barcode, chainId);
      if (barcodeMatches.length > 0) {
        const cheapest = barcodeMatches.reduce((current, candidate) =>
          candidate.price < current.price ? candidate : current,
        );

        console.log(
          `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=barcode product="${cheapest.originalName}" status=matched`,
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

    // 3. Produce catalog match — deterministic, by canonical key
    const produceResult = await this.matchByProduce(item, chainId);
    if (produceResult) return produceResult;

    // 4. Existing matchedProduct shortcut — try to resolve by externalProductCode or barcode
    if (
      item.matchedProduct &&
      item.selectionSource &&
      ['user_selected', 'barcode', 'auto_match'].includes(item.selectionSource)
    ) {
      const resolved = await this.resolveMatchedProduct(item, chainId);
      if (resolved) {
        return resolved;
      }
    }

    // 5. Name matching (fuzzy fallback)
    return this.matchByName(item, chainId);
  }

  private async resolveMatchedProduct(
    item: ShoppingItem,
    chainId: ChainId,
  ): Promise<Omit<MatchedBasketItem, 'regularTotalPrice' | 'effectiveTotalPrice' | 'effectiveUnitPrice' | 'appliedPromotion'> | null> {
    const mp = item.matchedProduct!;

    // Try by externalProductCode first
    if (mp.externalProductCode) {
      const product = await this.chainProductRepo.findByExternalId(mp.externalProductCode, chainId);
      if (product) {
        console.log(
          `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=matched_product(externalId) product="${product.originalName}" status=matched`,
        );
        return {
          shoppingItemId: item.id,
          shoppingItemName: item.name,
          itemQuantity: item.quantity,
          product,
          matchSource: 'matched_product',
          score: 1,
          isAmbiguous: false,
        };
      }

      // Try externalProductCode as barcode
      const barcodeMatches = await this.chainProductRepo.findByBarcode(mp.externalProductCode, chainId);
      if (barcodeMatches.length > 0) {
        const cheapest = barcodeMatches.reduce((current, candidate) =>
          candidate.price < current.price ? candidate : current,
        );
        console.log(
          `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=matched_product(barcode) product="${cheapest.originalName}" status=matched`,
        );
        return {
          shoppingItemId: item.id,
          shoppingItemName: item.name,
          itemQuantity: item.quantity,
          product: cheapest,
          matchSource: 'matched_product',
          score: 1,
          isAmbiguous: false,
        };
      }
    }

    console.log(
      `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=matched_product(fallback) status=not_resolved`,
    );
    return null;
  }

  private async matchByProduce(
    item: ShoppingItem,
    chainId: ChainId,
  ): Promise<Omit<MatchedBasketItem, 'regularTotalPrice' | 'effectiveTotalPrice' | 'effectiveUnitPrice' | 'appliedPromotion'> | null> {
    const normalizedInput = normalizeName(item.rawName ?? item.name);
    const produceMatch = matchProduceCanonical(normalizedInput);
    if (!produceMatch) return null;

    // Find or create global product for this produce
    const product = await this.productRepo.findOrCreateByCanonicalKey({
      canonicalKey: produceMatch.entry.canonicalKey,
      canonicalName: produceMatch.entry.canonicalName,
      normalizedName: produceMatch.entry.normalizedName,
      category: produceMatch.entry.category,
      unitType: produceMatch.entry.unitType,
      isWeighted: produceMatch.entry.isWeighted,
    });

    // Find chain products linked to this global product
    const chainProducts = await this.chainProductRepo.findByProductId(product.id, chainId);
    if (chainProducts.length === 0) {
      console.log(
        `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=produce canonicalKey=${produceMatch.entry.canonicalKey} status=no_chain_product`,
      );
      return null;
    }

    const cheapest = chainProducts.reduce((current, candidate) =>
      candidate.price < current.price ? candidate : current,
    );

    console.log(
      `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=produce canonicalKey=${produceMatch.entry.canonicalKey} product="${cheapest.originalName}" status=matched`,
    );

    return {
      shoppingItemId: item.id,
      shoppingItemName: item.name,
      itemQuantity: item.quantity,
      product: cheapest,
      matchSource: 'produce',
      score: 1,
      isAmbiguous: false,
    };
  }

  private async matchByName(
    item: ShoppingItem,
    chainId: ChainId,
  ): Promise<Omit<MatchedBasketItem, 'regularTotalPrice' | 'effectiveTotalPrice' | 'effectiveUnitPrice' | 'appliedPromotion'> | null> {
    const normalizedInput = normalizeName(item.rawName ?? item.name);
    const inputTokens = tokenSet(normalizedInput);
    const candidates = await this.chainProductRepo.findCandidatesByName(normalizedInput, chainId);

    if (candidates.length === 0) {
      console.log(
        `[COMPARE][MATCH] chain=${chainId} item="${item.name}" normalized="${normalizedInput}" candidates=0 status=unmatched`,
      );
      return null;
    }

    const scoredCandidates = candidates
      .map((product) => ({
        product,
        score: scoreProduct({
          inputTokens,
          normalizedInput,
          candidateNormalizedName: product.normalizedName,
          inputCategory: item.category,
        }),
      }))
      .filter((c) => c.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    const topScores = scoredCandidates.slice(0, 3).map((c) => c.score.toFixed(2));

    if (scoredCandidates.length === 0) {
      console.log(
        `[COMPARE][MATCH] chain=${chainId} item="${item.name}" normalized="${normalizedInput}" candidates=${candidates.length} topScores=[${topScores}] status=unmatched`,
      );
      return null;
    }

    const best = scoredCandidates[0];
    const second = scoredCandidates[1];
    const isAmbiguous = second !== undefined && best.score - second.score < AMBIGUOUS_GAP;

    console.log(
      `[COMPARE][MATCH] chain=${chainId} item="${item.name}" normalized="${normalizedInput}" candidates=${candidates.length} topScores=[${topScores}] selected="${best.product.originalName}" score=${best.score.toFixed(2)} status=${isAmbiguous ? 'ambiguous' : 'matched'}`,
    );

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

function pickCheapestChain(chains: ChainBasket[]): ChainId | null {
  const withMatches = chains.filter((chain) => chain.matchedItems.length > 0);
  if (withMatches.length === 0) {
    return null;
  }

  return withMatches.reduce((current, candidate) =>
    candidate.totalPrice < current.totalPrice ? candidate : current,
  ).chainId;
}
