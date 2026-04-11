import { AppError } from '../errors/app-error';
import { normalizeName, normalizeForMatching, tokenize } from '../utils/normalize';
import { ProductGroupRepository } from '../repositories/product-group.repository';
import { ProductVariantRepository } from '../repositories/product-variant.repository';
import { ChainProductRepository } from '../repositories/chain-product.repository';
import type { ProductGroup } from '../models/product-group.model';
import type { ProductVariant } from '../models/product-variant.model';
import type { ChainProduct, ChainId } from '../models/chain-product.model';
import { SUPPORTED_CHAINS } from '../models/chain-product.model';

/** Max results returned per chain */
const RESULTS_PER_CHAIN = 3;

/** Minimum score a candidate must reach to be included */
const MIN_SCORE = 2;

// ─── Scoring weights ────────────────────────────────────────────────────────
const INCLUDE_WEIGHT = 2;
const GENERAL_WEIGHT = 1;
const EXCLUDE_PENALTY = -3;

export interface ChainMatch {
  chainProductId: string;
  name: string;
  normalizedName: string;
  price: number;
  barcode?: string;
  score: number;
}

export interface GroupMappingResult {
  group: { id: string; name: string; category: string };
  variant?: { id: string; name: string };
  results: Record<string, ChainMatch[]>;
}

/**
 * Collects all matching rules from a group + optional variant into a single
 * flat structure that the scorer can consume without re-deriving every call.
 */
interface MatchingRules {
  /** Tokens that MUST appear — scored with +2 each */
  includeTokens: string[];
  /** Tokens that score +1 when found (general keywords) */
  generalTokens: string[];
  /** Tokens that score -3 when found — hard-disqualify when any matches */
  excludeTokens: string[];
  /** Union of include + general for the DB query (OR-based candidate fetch) */
  searchTokens: string[];
}

export class ProductGroupService {
  private readonly groupRepo: ProductGroupRepository;
  private readonly variantRepo: ProductVariantRepository;
  private readonly chainProductRepo: ChainProductRepository;

  constructor(
    groupRepo?: ProductGroupRepository,
    variantRepo?: ProductVariantRepository,
    chainProductRepo?: ChainProductRepository,
  ) {
    this.groupRepo = groupRepo ?? new ProductGroupRepository();
    this.variantRepo = variantRepo ?? new ProductVariantRepository();
    this.chainProductRepo = chainProductRepo ?? new ChainProductRepository();
  }

  // ─── Search ───────────────────────────────────────────────────────

  async search(query: string, limit = 20): Promise<ProductGroup[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const normalized = normalizeName(trimmed);
    return this.groupRepo.search(normalized, limit);
  }

  // ─── Get variants for a group ─────────────────────────────────────

  async getVariants(groupId: string): Promise<ProductVariant[]> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) throw new AppError('Product group not found', 404);

    return this.variantRepo.findByGroupId(groupId);
  }

  // ─── Map group (+ optional variant) → chain products ──────────────

  async mapToProducts(groupId: string, variantId?: string): Promise<GroupMappingResult> {
    const group = await this.groupRepo.findById(groupId);
    if (!group) throw new AppError('Product group not found', 404);

    let variant: ProductVariant | null = null;
    if (variantId) {
      variant = await this.variantRepo.findById(variantId);
      if (!variant || variant.groupId !== groupId) {
        throw new AppError('Product variant not found', 404);
      }
    }

    const rules = this.buildMatchingRules(group, variant);

    if (rules.searchTokens.length === 0) {
      return this.buildResult(group, variant, {});
    }

    // Query each chain in parallel
    const chainResults: Record<string, ChainMatch[]> = {};

    await Promise.all(
      SUPPORTED_CHAINS.map(async (chainId) => {
        const candidates = await this.findCandidatesForChain(chainId, rules.searchTokens);
        const scored = this.scoreAndRank(candidates, rules);
        if (scored.length > 0) {
          chainResults[chainId] = scored.slice(0, RESULTS_PER_CHAIN);
        }
      }),
    );

    return this.buildResult(group, variant, chainResults);
  }

  // ─── List all groups ──────────────────────────────────────────────

  async listAll(): Promise<ProductGroup[]> {
    return this.groupRepo.findAll();
  }

  // ─── Private: build matching rules ────────────────────────────────

  private buildMatchingRules(group: ProductGroup, variant: ProductVariant | null): MatchingRules {
    // Include keywords come from the explicit includeKeywords arrays.
    // If includeKeywords is empty, fall back to normalizedKeywords + name tokens
    // so existing seed data without include/exclude still works.
    const rawIncludes = [
      ...group.includeKeywords,
      ...(variant?.includeKeywords ?? []),
    ];

    const rawExcludes = [
      ...group.excludeKeywords,
      ...(variant?.excludeKeywords ?? []),
    ];

    const rawGeneral = [
      ...group.normalizedKeywords,
      ...(variant?.normalizedKeywords ?? []),
    ];

    // Normalize everything through the matching normalizer then tokenize
    const includeTokens = [...new Set(
      rawIncludes.flatMap((kw) => tokenize(normalizeForMatching(kw))),
    )];

    const excludeTokens = [...new Set(
      rawExcludes.flatMap((kw) => tokenize(normalizeForMatching(kw))),
    )];

    // General tokens: normalizedKeywords + name tokens, minus anything
    // already in include (avoid double-scoring)
    const includeSet = new Set(includeTokens);
    const groupNameTokens = tokenize(normalizeForMatching(group.name));
    const allGeneral = [
      ...rawGeneral.flatMap((kw) => tokenize(normalizeForMatching(kw))),
      ...groupNameTokens,
      ...(variant ? tokenize(normalizeForMatching(variant.name)) : []),
    ];
    const generalTokens = [...new Set(allGeneral.filter((t) => !includeSet.has(t)))];

    // If no explicit includeKeywords were provided, promote general tokens
    // to include so scoring still works for legacy seed data.
    if (includeTokens.length === 0 && generalTokens.length > 0) {
      includeTokens.push(...generalTokens.splice(0));
    }

    // Search tokens = everything positive (for the DB query)
    const searchTokens = [...new Set([...includeTokens, ...generalTokens])];

    return { includeTokens, generalTokens, excludeTokens, searchTokens };
  }

  // ─── Private: fetch candidates from a chain ───────────────────────

  private async findCandidatesForChain(
    chainId: ChainId,
    tokens: string[],
  ): Promise<ChainProduct[]> {
    const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regexPattern = escaped.length === 1 ? escaped[0] : `(${escaped.join('|')})`;

    return this.chainProductRepo.findCandidatesByName(regexPattern, chainId);
  }

  // ─── Private: score and rank candidates ───────────────────────────

  private scoreAndRank(candidates: ChainProduct[], rules: MatchingRules): ChainMatch[] {
    const scored: ChainMatch[] = [];

    for (const cp of candidates) {
      // Normalize the candidate name with the same pipeline
      const normalized = normalizeForMatching(cp.normalizedName);
      const candidateTokens = new Set(tokenize(normalized));

      const score = this.computeScore(candidateTokens, rules);

      if (score >= MIN_SCORE) {
        scored.push({
          chainProductId: cp.id,
          name: cp.originalName,
          normalizedName: cp.normalizedName,
          price: cp.price,
          barcode: cp.barcode,
          score,
        });
      }
    }

    // Sort by score desc, then price asc for tie-breaking
    scored.sort((a, b) => b.score - a.score || a.price - b.price);

    return scored;
  }

  private computeScore(candidateTokens: Set<string>, rules: MatchingRules): number {
    // Check excludes first — any exclude token found disqualifies immediately
    for (const token of rules.excludeTokens) {
      if (candidateTokens.has(token)) {
        return EXCLUDE_PENALTY; // Hard disqualify
      }
    }

    let score = 0;

    // Include keywords: +2 each
    let includeHits = 0;
    for (const token of rules.includeTokens) {
      if (candidateTokens.has(token)) {
        score += INCLUDE_WEIGHT;
        includeHits++;
      }
    }

    // Require at least half of include tokens to match
    if (rules.includeTokens.length > 0 && includeHits < Math.ceil(rules.includeTokens.length / 2)) {
      return 0;
    }

    // General keywords: +1 each
    for (const token of rules.generalTokens) {
      if (candidateTokens.has(token)) {
        score += GENERAL_WEIGHT;
      }
    }

    return score;
  }

  // ─── Private: build response ──────────────────────────────────────

  private buildResult(
    group: ProductGroup,
    variant: ProductVariant | null,
    results: Record<string, ChainMatch[]>,
  ): GroupMappingResult {
    return {
      group: { id: group.id, name: group.name, category: group.category },
      ...(variant ? { variant: { id: variant.id, name: variant.name } } : {}),
      results,
    };
  }
}
