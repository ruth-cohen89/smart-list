import { normalizeName } from './normalize';

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function tokenSet(str: string): Set<string> {
  return new Set(str.split(' ').filter(Boolean));
}

/** Tokenize and drop very short tokens (length < 2) */
export function meaningfulTokens(str: string): string[] {
  return str.split(' ').filter((t) => t.length >= 2);
}

// ---------------------------------------------------------------------------
// Jaccard — word tokens
// ---------------------------------------------------------------------------

export function jaccardTokens(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

// ---------------------------------------------------------------------------
// Jaccard — character bigrams (fuzzy fallback)
// ---------------------------------------------------------------------------

export function jaccardCharBigrams(a: string, b: string): number {
  return jaccardCharNgrams(a, b, 2);
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

// ---------------------------------------------------------------------------
// Combined product scoring — single source of truth
// ---------------------------------------------------------------------------

export interface ScoreProductOptions {
  inputTokens: Set<string>;
  normalizedInput: string;
  candidateNormalizedName: string;
  inputCategory?: string;
  candidateCategory?: string;
}

/**
 * Score a candidate product against a normalized input string.
 *
 * Scoring pipeline:
 *  1. Input recall  — intersection / inputTokens.size  (core signal)
 *  2. Prefix boost  — input token is prefix of a product token  (+0.15 per)
 *  3. Exact boost   — exact token match bonus  (+0.05 per)
 *  4. Extra-token penalty — unrelated product tokens reduce score
 *  5. Jaccard blend — standard Jaccard smooths multi-token queries
 *  6. Char-bigram fallback — catches partial / misspelled input
 *  7. Brevity bonus — prefer shorter (simpler) product names at equal recall
 *  8. Category bonus — small tiebreaker
 *
 * This is the SINGLE scoring function used by both matching.service
 * and price-comparison.service.
 */
export function scoreProduct(opts: ScoreProductOptions): number {
  const candidateTokens = tokenSet(opts.candidateNormalizedName);

  if (opts.inputTokens.size === 0 || candidateTokens.size === 0) return 0;

  // --- Step 1: Input recall + exact / prefix matching ---
  let exactMatches = 0;
  let prefixMatches = 0;

  for (const inputToken of opts.inputTokens) {
    if (candidateTokens.has(inputToken)) {
      exactMatches++;
    } else {
      // Check if inputToken is a prefix of any candidate token (e.g. "שוקו" → "שוקולד")
      for (const candidateToken of candidateTokens) {
        if (candidateToken.startsWith(inputToken) && inputToken.length >= 2) {
          prefixMatches++;
          break;
        }
      }
    }
  }

  const totalMatched = exactMatches + prefixMatches;
  const recall = totalMatched / opts.inputTokens.size;

  if (recall === 0) {
    // No token or prefix overlap — char-bigram only, capped low
    const charScore = jaccardCharBigrams(opts.normalizedInput, opts.candidateNormalizedName);
    return charScore * 0.45;
  }

  // Base score from recall
  let score = recall;

  // Exact-match boost: +0.05 per exact token (rewards precise matches)
  score += exactMatches * 0.05;

  // Prefix-match boost: +0.10 per prefix token (weaker than exact but still valuable)
  score += prefixMatches * 0.10;

  // --- Step 2: Extra-token penalty ---
  // Product tokens that do NOT match any input token (exact or prefix)
  let matchedCandidateTokens = 0;
  for (const candidateToken of candidateTokens) {
    for (const inputToken of opts.inputTokens) {
      if (candidateToken === inputToken || candidateToken.startsWith(inputToken)) {
        matchedCandidateTokens++;
        break;
      }
    }
  }
  const extraTokens = candidateTokens.size - matchedCandidateTokens;

  // Penalty: scales with how many product tokens are unrelated
  // For input "חלב" (1 token):
  //   "חלב תנובה 3%" → 2 extra out of 3 → ratio 0.67 → penalty 0.23
  //   "מקציף חלב"    → 1 extra out of 2 → ratio 0.50 → penalty 0.18
  //   BUT "מקציף חלב" has the input token in non-leading position,
  //   while "חלב תנובה" has it leading — position bonus below handles this.
  const extraRatio = candidateTokens.size > 0 ? extraTokens / candidateTokens.size : 0;
  const extraPenalty = extraRatio * 0.35;
  score -= extraPenalty;

  // --- Step 3: Position bonus — input token appears at start of product name ---
  // "חלב תנובה" should beat "מקציף חלב" for input "חלב"
  const candidateTokensArr = opts.candidateNormalizedName.split(' ').filter(Boolean);
  if (candidateTokensArr.length > 0) {
    const firstCandidateToken = candidateTokensArr[0];
    for (const inputToken of opts.inputTokens) {
      if (firstCandidateToken === inputToken || firstCandidateToken.startsWith(inputToken)) {
        score += 0.08;
        break;
      }
    }
  }

  // --- Step 4: Jaccard blend for multi-token queries ---
  // For multi-token input, standard Jaccard gives useful signal
  if (opts.inputTokens.size > 1) {
    const jaccard = jaccardTokens(opts.inputTokens, candidateTokens);
    // Blend: mostly recall-based, but Jaccard smooths edge cases
    score = score * 0.75 + jaccard * 0.25;
  }

  // --- Step 5: Char-bigram boost for partial matches ---
  if (recall < 1) {
    const charScore = jaccardCharBigrams(opts.normalizedInput, opts.candidateNormalizedName);
    if (charScore > score) {
      score = score * 0.65 + charScore * 0.35;
    }
  }

  // --- Step 6: Brevity bonus — prefer simpler product names ---
  // At equal recall, "חלב 3%" (2 tokens) should beat "חלב טרי תנובה בקרטון 3% 1 ליטר" (7 tokens)
  // Small bonus inversely proportional to candidate token count
  if (candidateTokens.size > 0) {
    const brevity = 1 / candidateTokens.size;
    score += brevity * 0.05;
  }

  // --- Step 7: Category bonus — tiebreaker ---
  if (
    opts.inputCategory &&
    opts.candidateCategory &&
    normalizeName(opts.inputCategory) === normalizeName(opts.candidateCategory)
  ) {
    score = Math.min(1, score + 0.05);
  }

  return Math.max(0, Math.min(1, score));
}
