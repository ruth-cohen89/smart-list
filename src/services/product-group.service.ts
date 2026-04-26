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

/** Bonus added per extra chain a barcode appears in (beyond the first) */
const COVERAGE_BONUS = 1.5;

/** Penalty applied to extra (unrelated) tokens in a candidate name */
const EXTRA_TOKEN_PENALTY = 1.5;

/** Bonus when an include token appears as the first token in the candidate */
const POSITION_BONUS = 0.5;

// ─── Global blocklist for food groups ──────────────────────────────────────
// Applied to all groups in department "מזון" or "משקאות" to prevent
// cosmetics / hygiene / pet products from contaminating food results.
const FOOD_DEPARTMENTS = new Set(['מזון', 'משקאות']);
const FOOD_GLOBAL_EXCLUDES = new Set([
  'שמפו', 'מרכך', 'סבון', 'קרם', 'תחליב', 'רחצה',
  'דאודורנט', 'טיפוח', 'לשיער', 'לגוף', 'לפנים',
  'לידיים', 'מברשת', 'משחת', 'שיניים', 'מגבונים',
  'חיתולים', 'ניקוי', 'לכביסה',
  'לחתול', 'לכלב',
]);

export interface ChainMatch {
  chainProductId: string;
  productId?: string;
  name: string;
  normalizedName: string;
  price: number;
  barcode?: string;
  score: number;
  isWeighted?: boolean;
  productType?: string;
}

export interface GroupMappingResult {
  group: { id: string; name: string; department: string; category: string; selectionMode: string };
  variant?: { id: string; name: string };
  results: Record<string, ChainMatch[]>;
}

/**
 * Collects all matching rules from a group + optional variant into a single
 * flat structure that the scorer can consume without re-deriving every call.
 */
interface MatchingRules {
  /** Group department — used for global food-safety filter */
  department: string;
  /** Tokens that MUST appear — scored with +2 each */
  includeTokens: string[];
  /** Canonical include tokens plus alias token sets, each matched as an alternative */
  includeTokenSets: string[][];
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

    // 1. Try exact substring match (fast path)
    const exact = await this.groupRepo.search(normalized, limit);
    if (exact.length > 0) return exact;

    // 2. Multi-word fallback: name-IDF weighted ranking
    //    Groups are scored primarily by name-level matches, with tokens that
    //    appear in fewer group names carrying more weight.  This makes "שקדים"
    //    (1 group name) outweigh "חלב" (2 group names) in "חלב שקדים".
    //    Keyword/alias matches add a small flat bonus (secondary signal).
    //    A head-in-name bonus breaks ties when the first query token matches
    //    a group name (so "קמח" beats "מלא" for "קמח חיטה מלא").
    const tokens = normalized.split(' ').filter((t) => t.length >= 2);
    if (tokens.length < 2) return [];

    const [candidates, allGroups] = await Promise.all([
      this.groupRepo.searchByTokens(tokens, limit * 2),
      this.groupRepo.findAll(),
    ]);
    if (candidates.length === 0) return [];

    // Name-level document frequency: how many group names contain each token
    const tokenNameDF = new Map<string, number>();
    for (const token of tokens) {
      let df = 0;
      for (const g of allGroups) {
        if (g.normalizedName.includes(token)) df++;
      }
      tokenNameDF.set(token, Math.max(df, 1));
    }

    const scored = candidates.map((group) => {
      const nameText = group.normalizedName;
      const kwText = [...group.normalizedKeywords, ...group.aliases.map(normalizeName)]
        .join(' ')
        .toLowerCase();

      let score = 0;
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (nameText.includes(token)) {
          // Name match — weighted by name IDF (rarer = higher)
          score += 1 / tokenNameDF.get(token)!;
          // Head-in-name bonus: query's first token in group name
          if (i === 0) score += 0.2;
        } else if (kwText.includes(token)) {
          // Keyword/alias match — flat low bonus (secondary signal)
          score += 0.1;
        }
      }
      return { group, score };
    });

    scored.sort((a, b) => b.score - a.score || b.group.priority - a.group.priority);

    return scored.slice(0, limit).map((s) => s.group);
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

    // Use only include tokens for the DB query — general tokens are too
    // broad and crowd out relevant candidates within the result limit.
    // Strip `%` for the DB query because normalizedName was built with
    // normalizeName() which removes `%`.
    const dbQueryTokenSets = (rules.includeTokenSets.length > 0
      ? rules.includeTokenSets
      : [rules.searchTokens])
      .map((tokens) => tokens.map((t) => t.replace(/%/g, '')).filter(Boolean))
      .filter((tokens) => tokens.length > 0);

    // 1. Fetch and score candidates per chain (parallel)
    const perChainScored: Record<string, ChainMatch[]> = {};

    await Promise.all(
      SUPPORTED_CHAINS.map(async (chainId) => {
        const candidates = await this.findCandidatesForChain(chainId, dbQueryTokenSets);
        const scored = this.scoreAndRank(candidates, rules);
        perChainScored[chainId] = scored;
      }),
    );

    // 2. Compute cross-chain coverage — count how many chains each barcode appears in
    const barcodeCoverage = this.computeBarcodeCoverage(perChainScored);

    // 3. Apply coverage bonus and re-sort, then take top N per chain
    const chainResults: Record<string, ChainMatch[]> = {};
    for (const chainId of SUPPORTED_CHAINS) {
      const scored = perChainScored[chainId] ?? [];
      const boosted = this.applyCoverageBonus(scored, barcodeCoverage);
      if (boosted.length > 0) {
        chainResults[chainId] = boosted.slice(0, RESULTS_PER_CHAIN);
      }
    }

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

    const aliasTokenSets = group.aliases
      .map((alias) => uniqueTokens(tokenize(normalizeForMatching(alias))))
      .filter((tokens) => tokens.length > 0);
    let includeTokenSets = uniqueTokenSets([
      ...(includeTokens.length > 0 ? [includeTokens] : []),
      ...aliasTokenSets,
    ]);

    // General tokens: normalizedKeywords + name tokens, minus anything
    // already in include alternatives (avoid double-scoring)
    const includeSet = new Set(includeTokenSets.flat());
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
      includeTokenSets = uniqueTokenSets([
        includeTokens,
        ...aliasTokenSets,
      ]);
    }

    // Search tokens = everything positive (for the DB query)
    const searchTokens = [...new Set([
      ...includeTokenSets.flat(),
      ...includeTokens,
      ...generalTokens,
    ])];

    return { department: group.department, includeTokens, includeTokenSets, generalTokens, excludeTokens, searchTokens };
  }

  // ─── Private: fetch candidates from a chain ───────────────────────

  private async findCandidatesForChain(
    chainId: ChainId,
    tokenSets: string[][],
  ): Promise<ChainProduct[]> {
    // Pass each token set as a space-joined string — the repository handles
    // tokenization and regex construction itself. Multiple sets represent
    // canonical/alias alternatives, so de-dupe the combined candidates.
    const uniqueCandidates = new Map<string, ChainProduct>();

    await Promise.all(tokenSets.map(async (tokens) => {
      const queryName = tokens.join(' ');
      console.log(`[ProductGroupService] findCandidates chainId=${chainId} tokens=[${tokens.join(', ')}]`);
      const candidates = await this.chainProductRepo.findCandidatesByName(queryName, chainId);
      console.log(`[ProductGroupService] chainId=${chainId} tokens=[${tokens.join(', ')}] candidates=${candidates.length}`);
      for (const candidate of candidates) {
        uniqueCandidates.set(candidate.id, candidate);
      }
    }));

    return [...uniqueCandidates.values()];
  }

  // ─── Private: score and rank candidates ───────────────────────────

  private scoreAndRank(candidates: ChainProduct[], rules: MatchingRules): ChainMatch[] {
    const scored: ChainMatch[] = [];

    for (const cp of candidates) {
      // Normalize from originalName so percentage signs (3%) are preserved
      // through normalizeForMatching — cp.normalizedName already had them stripped.
      const normalized = normalizeForMatching(cp.originalName);
      const candidateTokens = new Set(tokenize(normalized));

      const score = this.computeScore(candidateTokens, normalized, rules);

      if (score >= MIN_SCORE) {
        scored.push({
          chainProductId: cp.id,
          productId: cp.productId,
          name: cp.originalName,
          normalizedName: cp.normalizedName,
          price: cp.price,
          barcode: cp.barcode,
          score,
          isWeighted: cp.isWeighted,
          productType: cp.productType,
        });
      }
    }

    // Sort by score desc, then price asc for tie-breaking
    scored.sort((a, b) => b.score - a.score || a.price - b.price);

    if (scored.length > 0) {
      const top = scored.slice(0, 3);
      console.log(
        `[ProductGroupService] top matches: ${top.map((m) => `"${m.name}" score=${m.score} price=${m.price}`).join(', ')}`,
      );
    }

    return scored;
  }

  private computeScore(
    candidateTokens: Set<string>,
    candidateText: string,
    rules: MatchingRules,
  ): number {
    // ── Global food-safety filter ─────────────────────────────────
    // Reject cosmetics / hygiene / pet products from food groups.
    if (FOOD_DEPARTMENTS.has(rules.department)) {
      for (const token of candidateTokens) {
        if (FOOD_GLOBAL_EXCLUDES.has(token)) return EXCLUDE_PENALTY;
      }
    }

    // ── Exclude check ──────────────────────────────────────────────
    // Use substring matching on the full normalized text so that
    // "שוקולד" catches compounds like "שוק.חלב" or "חלבון".
    for (const token of rules.excludeTokens) {
      // Exact token match
      if (candidateTokens.has(token)) return EXCLUDE_PENALTY;
      // Substring match — catches partial/compound forms
      if (substringMatch(candidateText, token)) return EXCLUDE_PENALTY;
    }

    // ── Include check — one complete canonical/alias set must match ─
    // Use both exact token match and substring match on the full text
    // to handle Hebrew singular/plural (עגבני → עגבניות/עגבניה).
    let score = 0;
    const matchedIncludeTokens = this.findMatchingIncludeTokenSet(candidateTokens, candidateText, rules);
    if (!matchedIncludeTokens) return 0;
    score += matchedIncludeTokens.length * INCLUDE_WEIGHT;

    // ── General keywords: +1 each ─────────────────────────────────
    let generalMatched = 0;
    for (const token of rules.generalTokens) {
      if (candidateTokens.has(token) || substringMatch(candidateText, token)) {
        score += GENERAL_WEIGHT;
        generalMatched++;
      }
    }

    // ── Ranking signals (tiebreakers within passing products) ──────
    // These signals differentiate candidates that all pass the include
    // check. They must never push a valid candidate below MIN_SCORE.

    // Brevity penalty: more unrelated tokens → less relevant product.
    // "שיבולת שועל 500 גר" beats "תחליב רחצה מועשר בשיבולת שועל 3 ליטר"
    const keywordMatchCount = matchedIncludeTokens.length + generalMatched;
    const extraTokens = Math.max(0, candidateTokens.size - keywordMatchCount);
    if (candidateTokens.size > 0) {
      const extraRatio = extraTokens / candidateTokens.size;
      score -= extraRatio * EXTRA_TOKEN_PENALTY;
    }

    // Position bonus: include keyword at start of name is a stronger signal.
    // "שיבולת שועל דייסה" beats "משקה בתוספת שיבולת שועל"
    const firstToken = candidateText.split(' ')[0];
    if (firstToken) {
      for (const t of matchedIncludeTokens) {
        if (firstToken === t || firstToken.startsWith(t)) {
          score += POSITION_BONUS;
          break;
        }
      }
    }

    // Floor: ranking signals are tiebreakers — never disqualify a
    // candidate that passed the include check.
    return Math.max(score, MIN_SCORE);
  }

  private findMatchingIncludeTokenSet(
    candidateTokens: Set<string>,
    candidateText: string,
    rules: MatchingRules,
  ): string[] | null {
    if (rules.includeTokenSets.length === 0) return [];

    // Try longer (more specific) sets first so a product explicitly matching
    // [מלח, ים] gets credit for 2 tokens rather than falling through to [מלח].
    // This prevents the single-token fallback from masking better alias matches.
    const sorted = [...rules.includeTokenSets].sort((a, b) => b.length - a.length);

    for (const tokenSet of sorted) {
      // Use substringMatch (word-boundary for tokens ≤3 chars) so that short
      // keywords like "חלה" do not spuriously match inside unrelated words such
      // as "אחלה". Longer tokens fall through to plain includes(), which handles
      // Hebrew plural/singular and prefixed forms (e.g. "עגבני" → "עגבניות").
      const matchesAll = tokenSet.every((token) =>
        candidateTokens.has(token) || substringMatch(candidateText, token),
      );
      if (matchesAll) return tokenSet;
    }

    return null;
  }

  // ─── Private: cross-chain coverage ─────────────────────────────────

  /**
   * Count how many chains each barcode appears in across all scored results.
   * Returns a map of barcode → chain count.
   */
  private computeBarcodeCoverage(
    perChainScored: Record<string, ChainMatch[]>,
  ): Map<string, number> {
    const barcodeChains = new Map<string, Set<string>>();

    for (const [chainId, matches] of Object.entries(perChainScored)) {
      for (const match of matches) {
        if (!match.barcode) continue;
        let chains = barcodeChains.get(match.barcode);
        if (!chains) {
          chains = new Set();
          barcodeChains.set(match.barcode, chains);
        }
        chains.add(chainId);
      }
    }

    const coverage = new Map<string, number>();
    for (const [barcode, chains] of barcodeChains) {
      coverage.set(barcode, chains.size);
    }
    return coverage;
  }

  /**
   * Add a coverage bonus to products that exist in multiple chains,
   * then re-sort by boosted score.
   */
  private applyCoverageBonus(
    scored: ChainMatch[],
    barcodeCoverage: Map<string, number>,
  ): ChainMatch[] {
    const boosted = scored.map((match) => {
      const chainCount = match.barcode ? (barcodeCoverage.get(match.barcode) ?? 1) : 1;
      const bonus = (chainCount - 1) * COVERAGE_BONUS;
      return { ...match, score: match.score + bonus };
    });

    boosted.sort((a, b) => b.score - a.score || a.price - b.price);
    return boosted;
  }

  // ─── Private: build response ──────────────────────────────────────

  private buildResult(
    group: ProductGroup,
    variant: ProductVariant | null,
    results: Record<string, ChainMatch[]>,
  ): GroupMappingResult {
    return {
      group: { id: group.id, name: group.name, department: group.department, category: group.category, selectionMode: group.selectionMode },
      ...(variant ? { variant: { id: variant.id, name: variant.name } } : {}),
      results,
    };
  }
}

// ─── Module-level helpers ────────────────────────────────────────────────

/** Regex cache for substringMatch — avoids re-compiling the same patterns */
const substringRegexCache = new Map<string, RegExp>();

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

function uniqueTokenSets(tokenSets: string[][]): string[][] {
  const seen = new Set<string>();
  const unique: string[][] = [];

  for (const tokenSet of tokenSets) {
    const tokens = uniqueTokens(tokenSet);
    if (tokens.length === 0) continue;

    const key = tokens.join('\u0000');
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(tokens);
  }

  return unique;
}

/**
 * Word-boundary-aware substring check.
 * For short tokens (≤3 chars) require a word boundary so "חלה" does not
 * match inside "אחלה" or "נחלה". Longer tokens use plain substring
 * matching to handle Hebrew plural/singular (e.g. "עגבני" → "עגבניות").
 */
function substringMatch(text: string, token: string): boolean {
  if (token.length <= 3) {
    let re = substringRegexCache.get(token);
    if (!re) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp(`(?:^|\\s)${escaped}`);
      substringRegexCache.set(token, re);
    }
    return re.test(text);
  }
  return text.includes(token);
}
