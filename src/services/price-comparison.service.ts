import { ShoppingListRepository } from '../repositories/shopping-list.repository';
import { ChainProductRepository } from '../repositories/chain-product.repository';
import { normalizeName } from '../utils/normalize';
import { tokenSet, scoreProduct } from '../utils/scoring';
import { computeBestEffectivePrice } from './effective-price.service';
import {
  matchProduceCanonical,
  PRODUCE_HARD_EXCLUDE_TOKENS,
  PRODUCE_SUBTYPE_TOKENS,
  type ProduceMatchResult,
} from '../data/produce-catalog';
import { ProductRepository } from '../repositories/product.repository';
import type { ShoppingItem } from '../models/shopping-list.model';
import type { ChainProduct, ChainId, ProductPromotionSnapshot } from '../models/chain-product.model';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';

export type MatchSource = 'product_id' | 'barcode' | 'produce' | 'name' | 'matched_product';

export type PricingAccuracy = 'accurate' | 'approximate';

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
  pricingAccuracy: PricingAccuracy;
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
  hasApproximatePricing: boolean;
  isComparable: boolean;
  accurateItemsCount: number;
  totalItemsCount: number;
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
        const effectivePrice = computeBestEffectivePrice(result.product, item.quantity, item.unit);
        if (effectivePrice.appliedPromotion) {
          console.log(
            `[COMPARE] active promo applied chainId=${chainId} itemCode=${result.product.externalId} promotionId=${effectivePrice.appliedPromotion.promotionId} quantity=${item.quantity} unit=${item.unit ?? 'none'} total=${effectivePrice.effectiveTotalPrice}`,
          );
        }

        const isWeighted = result.product.isWeighted ?? (result.product.productType === 'produce');
        const pricingAccuracy: PricingAccuracy =
          isWeighted && (!item.unit || item.unit === 'UNIT') ? 'approximate' : 'accurate';

        matchedItems.push({
          ...result,
          regularTotalPrice: effectivePrice.regularTotalPrice,
          effectiveTotalPrice: effectivePrice.effectiveTotalPrice,
          effectiveUnitPrice: effectivePrice.effectiveUnitPrice,
          appliedPromotion: effectivePrice.appliedPromotion,
          pricingAccuracy,
        });
      } else {
        unmatchedItems.push({ shoppingItemId: item.id, shoppingItemName: item.name });
      }
    }

    const accurateItems = matchedItems.filter((i) => i.pricingAccuracy === 'accurate');
    const totalPrice = accurateItems.reduce((sum, i) => sum + i.effectiveTotalPrice, 0);
    const hasApproximatePricing = matchedItems.some((i) => i.pricingAccuracy === 'approximate');
    const isComparable = accurateItems.length > 0;

    return {
      chainId,
      totalPrice,
      matchedItems,
      unmatchedItems,
      hasApproximatePricing,
      isComparable,
      accurateItemsCount: accurateItems.length,
      totalItemsCount: matchedItems.length,
    };
  }

  private async matchItemToChain(
    item: ShoppingItem,
    chainId: ChainId,
  ): Promise<Omit<MatchedBasketItem, 'regularTotalPrice' | 'effectiveTotalPrice' | 'effectiveUnitPrice' | 'appliedPromotion' | 'pricingAccuracy'> | null> {
    // Produce detection uses item.name — NOT rawName.
    //
    // rawName comes from receipt OCR and can be a completely unrelated product
    // (e.g. rawName="בייגלה שומשום" for a "שום" list entry, or
    //       rawName="פטל לימון TWO 40 סטיק" for a "לימון" entry).
    // Using rawName causes two bugs:
    //   1. matchProduceCanonical misses the produce intent (שום not whole-word in שומשום)
    //   2. After produce path fails, barcode/name fallback matches the receipt product
    //
    // item.name is the user-facing canonical name and is the correct signal.
    const produceMatch = matchProduceCanonical(normalizeName(item.name));

    // 1. Produce items — run produce-specific matching.
    //    Never fall through to barcode/productId/name-packaged matching:
    //    a produce item showing "not found" is correct; matching the wrong
    //    packaged product (the receipt barcode) is not.
    if (produceMatch) {
      // Produce items use ONLY the produce pipeline — never barcode / productId / name matching.
      // "Not found" is always better than a wrong packaged-product match.
      return this.matchByProduce(item, chainId, produceMatch);
    }

    // 2. productId — highest priority for packaged products (global product identity)
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

    // 3. Barcode match — strict: if item has a barcode, match by barcode only.
    //    Do NOT fall back to name matching for barcode items, because a similar
    //    name can map to a completely different product (wrong size, fat %, etc.).
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

      // Barcode not found in this chain — return null (unmatched).
      // No name fallback: accuracy > match count.
      console.log(
        `[COMPARE][MATCH] chain=${chainId} item="${item.name}" barcode=${item.barcode} status=unmatched_barcode_not_in_chain`,
      );
      return null;
    }

    // ── Below: only packaged items WITHOUT a barcode ──

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

    // 5. Name matching (fuzzy fallback) — only for non-barcode packaged items
    return this.matchByName(item, chainId);
  }

  private async resolveMatchedProduct(
    item: ShoppingItem,
    chainId: ChainId,
  ): Promise<Omit<MatchedBasketItem, 'regularTotalPrice' | 'effectiveTotalPrice' | 'effectiveUnitPrice' | 'appliedPromotion' | 'pricingAccuracy'> | null> {
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

  /**
   * Classify a chain-product candidate for produce matching.
   *
   * Returns:
   *  'excluded' — never a fresh-produce match (processed food, frozen, branded, etc.)
   *  'subtype'  — a specific variety (גזר סגול, לימון בלאדי, etc.) — only used when
   *               the user explicitly requested that subtype
   *  'base'     — plain fresh produce — always preferred
   *
   * Checks applied (in order):
   *  1. Latin characters in the normalizedName → branded/packaged product
   *  2. PRODUCE_HARD_EXCLUDE_TOKENS (frozen forms, processed foods, etc.)
   *  3. Per-entry excludeTokens (pickled, canned sauce, juice, etc.)
   *  4. PRODUCE_SUBTYPE_TOKENS (specific variety/color indicators)
   */
  private classifyProduceCandidate(
    normalizedName: string,
    entryExcludeTokens: readonly string[],
  ): 'base' | 'subtype' | 'excluded' {
    // Latin letters → branded / packaged product (e.g. "עגבניות שלמות livato", "פטל לימון two 40 סטיק")
    if (/[a-z]/.test(normalizedName)) return 'excluded';
    if (PRODUCE_HARD_EXCLUDE_TOKENS.some((t) => normalizedName.includes(t))) return 'excluded';
    if (entryExcludeTokens.some((t) => normalizedName.includes(t))) return 'excluded';
    if (PRODUCE_SUBTYPE_TOKENS.some((t) => normalizedName.includes(t))) return 'subtype';
    return 'base';
  }

  private async matchByProduce(
    item: ShoppingItem,
    chainId: ChainId,
    produceMatch: ProduceMatchResult,
  ): Promise<Omit<MatchedBasketItem, 'regularTotalPrice' | 'effectiveTotalPrice' | 'effectiveUnitPrice' | 'appliedPromotion' | 'pricingAccuracy'> | null> {
    const normalizedInput = normalizeName(item.name);

    const product = await this.productRepo.findOrCreateByCanonicalKey({
      canonicalKey: produceMatch.entry.canonicalKey,
      canonicalName: produceMatch.entry.canonicalName,
      normalizedName: produceMatch.entry.normalizedName,
      category: produceMatch.entry.category,
      unitType: produceMatch.entry.unitType,
      isWeighted: produceMatch.entry.isWeighted,
    });

    const entryExcludeTokens = [
      ...(produceMatch.entry.excludeTokens ?? []),
      ...(produceMatch.entry.matchExcludeTokens ?? []),
    ];
    const normalizedAliases = produceMatch.entry.normalizedAliases;

    // Source 1: productId-linked candidates.
    // Alias anchor: name must start with a produce alias — guards against false ingestion
    // links (e.g. "כותש שום") where the alias matched mid-name during import.
    let linked = (await this.chainProductRepo.findByProductId(product.id, chainId)).filter((p) => {
      const name = p.normalizedName ?? '';
      return normalizedAliases.some((alias) => name === alias || name.startsWith(alias + ' '));
    });

    // Source 2: alias-scoped query — whole-word match anywhere in normalizedName.
    // Does NOT filter by productType to avoid relying on consistent DB tagging.
    // classifyProduceCandidate + scoring below are the gates against packaged items.
    if (linked.length === 0) {
      linked = await this.chainProductRepo.findByProduceAliases(chainId, normalizedAliases);
      if (linked.length > 0) {
        console.log(
          `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=produce canonicalKey=${produceMatch.entry.canonicalKey} status=using_alias_candidates linked=${linked.length}`,
        );
      }
    }

    if (linked.length === 0) {
      console.log(
        `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=produce canonicalKey=${produceMatch.entry.canonicalKey} status=no_chain_product`,
      );
      return null;
    }

    // Strict pre-scoring filter: reject Latin (branded), frozen, processed, per-entry excludes.
    const base: typeof linked = [];
    const subtype: typeof linked = [];
    for (const p of linked) {
      const cls = this.classifyProduceCandidate(p.normalizedName ?? '', entryExcludeTokens);
      if (cls === 'base') base.push(p);
      else if (cls === 'subtype') subtype.push(p);
      // 'excluded' → silently dropped
    }

    const inputContainsSubtype = PRODUCE_SUBTYPE_TOKENS.some((t) => normalizedInput.includes(t));
    let candidates: typeof linked;
    if (base.length > 0) {
      candidates = base;
    } else if (inputContainsSubtype && subtype.length > 0) {
      candidates = subtype;
    } else {
      console.log(
        `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=produce canonicalKey=${produceMatch.entry.canonicalKey} ` +
          `base=0 subtype=${subtype.length} inputSubtype=${inputContainsSubtype} status=no_clean_candidate`,
      );
      return null;
    }

    // Token-overlap scoring — pure recall (intersection / inputTokens.size).
    // No char-bigram fallback. Require ≥0.7 to reject weak partial matches.
    const inputTokens = tokenSet(normalizedInput);
    const scored = candidates
      .map((p) => {
        const candidateTokens = tokenSet(p.normalizedName ?? '');
        const intersection = [...inputTokens].filter((t) => candidateTokens.has(t)).length;
        const score = inputTokens.size > 0 ? intersection / inputTokens.size : 0;
        return { p, score };
      })
      .filter((c) => c.score >= 0.7)
      .sort((a, b) => {
        const aW = a.p.isWeighted ? 0 : 1;
        const bW = b.p.isWeighted ? 0 : 1;
        if (aW !== bW) return aW - bW;
        const aT = (a.p.normalizedName ?? '').split(' ').filter(Boolean).length;
        const bT = (b.p.normalizedName ?? '').split(' ').filter(Boolean).length;
        if (aT !== bT) return aT - bT;
        return a.p.price - b.p.price;
      });

    if (scored.length === 0) {
      console.log(
        `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=produce canonicalKey=${produceMatch.entry.canonicalKey} status=no_scored_match`,
      );
      return null;
    }

    const best = scored[0].p;
    console.log(
      `[COMPARE][MATCH] chain=${chainId} item="${item.name}" source=produce canonicalKey=${produceMatch.entry.canonicalKey} product="${best.originalName}" status=matched`,
    );

    return {
      shoppingItemId: item.id,
      shoppingItemName: item.name,
      itemQuantity: item.quantity,
      product: best,
      matchSource: 'produce',
      score: 1,
      isAmbiguous: false,
    };
  }

  private async matchByName(
    item: ShoppingItem,
    chainId: ChainId,
    options: {
      produceOnly?: boolean;
      excludeTokens?: string[];
      produceAliases?: string[];
      // Produce fallback passes item.name here so the DB search uses the user's
      // intended produce name, not the rawName (which is an unrelated receipt product).
      normalizedQueryOverride?: string;
    } = {},
  ): Promise<Omit<MatchedBasketItem, 'regularTotalPrice' | 'effectiveTotalPrice' | 'effectiveUnitPrice' | 'appliedPromotion' | 'pricingAccuracy'> | null> {
    const normalizedInput = options.normalizedQueryOverride ?? normalizeName(item.rawName ?? item.name);
    const inputTokens = tokenSet(normalizedInput);
    const candidates = await this.chainProductRepo.findCandidatesByName(normalizedInput, chainId);

    if (candidates.length === 0) {
      console.log(
        `[COMPARE][MATCH] chain=${chainId} item="${item.name}" normalized="${normalizedInput}" candidates=0 status=unmatched`,
      );
      return null;
    }

    let filtered = candidates;
    if (options.excludeTokens && options.excludeTokens.length > 0) {
      filtered = filtered.filter((p) => {
        const name = p.normalizedName ?? '';
        return !options.excludeTokens!.some((t) => name.includes(t));
      });
    }
    if (options.produceAliases && options.produceAliases.length > 0) {
      // Alias anchor: name must start with a produce alias.
      filtered = filtered.filter((p) => {
        const name = p.normalizedName ?? '';
        return options.produceAliases!.some((alias) => name === alias || name.startsWith(alias + ' '));
      });

      // Apply the same classification as matchByProduce:
      // excluded (Latin, frozen, processed) → dropped entirely
      // subtype → only kept when the user's query contains a subtype token
      const inputContainsSubtype = PRODUCE_SUBTYPE_TOKENS.some((t) => normalizedInput.includes(t));
      const base: typeof filtered = [];
      const subtype: typeof filtered = [];
      for (const p of filtered) {
        const cls = this.classifyProduceCandidate(p.normalizedName ?? '', options.excludeTokens ?? []);
        if (cls === 'base') base.push(p);
        else if (cls === 'subtype') subtype.push(p);
      }
      if (base.length > 0) {
        filtered = base;
      } else if (inputContainsSubtype && subtype.length > 0) {
        filtered = subtype;
      } else {
        filtered = [];
      }
    }
    if (filtered.length === 0) return null;

    const scoredCandidates = filtered
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
  const withMatches = chains.filter((chain) => chain.isComparable);
  if (withMatches.length === 0) {
    return null;
  }

  return withMatches.reduce((current, candidate) =>
    candidate.totalPrice < current.totalPrice ? candidate : current,
  ).chainId;
}
