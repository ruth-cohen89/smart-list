import { matchProduceCanonical, PRODUCE_CATALOG } from '../../../src/data/produce-catalog';
import { normalizeName } from '../../../src/utils/normalize';

describe('PRODUCE_CATALOG', () => {
  it('contains entries with unique canonicalKeys', () => {
    const keys = PRODUCE_CATALOG.map((e) => e.canonicalKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every entry has at least one alias', () => {
    for (const entry of PRODUCE_CATALOG) {
      expect(entry.aliases.length).toBeGreaterThan(0);
    }
  });

  it('normalizedName matches normalizeName(canonicalName)', () => {
    for (const entry of PRODUCE_CATALOG) {
      expect(entry.normalizedName).toBe(normalizeName(entry.canonicalName));
    }
  });

  it('normalizedAliases match normalizeName applied to each alias', () => {
    for (const entry of PRODUCE_CATALOG) {
      expect(entry.normalizedAliases).toEqual(entry.aliases.map(normalizeName));
    }
  });
});

describe('matchProduceCanonical', () => {
  // ── Exact matches ─────────────────────────────────────────────────────

  it('matches exact canonical name', () => {
    const result = matchProduceCanonical(normalizeName('עגבניה'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('tomato');
  });

  it('matches exact alias', () => {
    const result = matchProduceCanonical(normalizeName('עגבניות שרי'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('tomato-cherry');
  });

  it('matches plural form alias', () => {
    const result = matchProduceCanonical(normalizeName('בננות'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('banana');
  });

  // ── Substring / contained matches ─────────────────────────────────────

  it('matches alias contained in longer input (word boundaries)', () => {
    const result = matchProduceCanonical(normalizeName('עגבניות שרי מתוקות מארז'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('tomato-cherry');
  });

  it('matches alias at start of input', () => {
    const result = matchProduceCanonical(normalizeName('בננה אורגנית מארז'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('banana');
  });

  it('matches alias at end of input', () => {
    const result = matchProduceCanonical(normalizeName('טרי ברוקולי'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('broccoli');
  });

  // ── Specificity: longer alias wins ────────────────────────────────────

  it('prefers longer alias over shorter one', () => {
    // "עגבניות שרי מתוקות" (17 chars) should win over "עגבניות" (7 chars)
    const result = matchProduceCanonical(normalizeName('עגבניות שרי מתוקות'));
    expect(result).not.toBeNull();
    expect(result!.matchedAlias).toBe(normalizeName('עגבניות שרי מתוקות'));
  });

  // ── Non-matches ───────────────────────────────────────────────────────

  it('returns null for empty input', () => {
    expect(matchProduceCanonical('')).toBeNull();
  });

  it('returns null for non-produce packaged goods', () => {
    expect(matchProduceCanonical(normalizeName('חלב תנובה 3%'))).toBeNull();
  });

  it('returns null for partial token that is not a word boundary', () => {
    // "גזרי" is not a whole-word match for "גזר"
    expect(matchProduceCanonical(normalizeName('גזרית'))).toBeNull();
  });

  // ── Various produce categories ────────────────────────────────────────

  it('matches fruits', () => {
    const result = matchProduceCanonical(normalizeName('תפוז'));
    expect(result).not.toBeNull();
    expect(result!.entry.category).toBe('פרי');
  });

  it('matches vegetables', () => {
    const result = matchProduceCanonical(normalizeName('מלפפון'));
    expect(result).not.toBeNull();
    expect(result!.entry.category).toBe('ירק');
  });

  it('matches herbs', () => {
    const result = matchProduceCanonical(normalizeName('כוסברה'));
    expect(result).not.toBeNull();
    expect(result!.entry.category).toBe('עשבי תיבול');
  });

  // ── Alternate spelling ────────────────────────────────────────────────

  it('matches alternate spellings via aliases', () => {
    const result = matchProduceCanonical(normalizeName('כוזברה'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('cilantro');
  });

  it('matches alternative pepper names', () => {
    const result = matchProduceCanonical(normalizeName('גמבה אדומה'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('pepper-red');
  });

  // ── Multi-word canonical names ────────────────────────────────────────

  it('matches multi-word produce like תפוח אדמה', () => {
    const result = matchProduceCanonical(normalizeName('תפוח אדמה'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('potato');
  });

  it('matches sweet potato alias בטטה', () => {
    const result = matchProduceCanonical(normalizeName('בטטה'));
    expect(result).not.toBeNull();
    expect(result!.entry.canonicalKey).toBe('sweet-potato');
  });

  // ── Weight / unit type correctness ────────────────────────────────────

  it('tomato is weighted and sold by kg', () => {
    const result = matchProduceCanonical(normalizeName('עגבניה'));
    expect(result!.entry.isWeighted).toBe(true);
    expect(result!.entry.unitType).toBe('ק"ג');
  });

  it('lettuce is sold by unit', () => {
    const result = matchProduceCanonical(normalizeName('חסה'));
    expect(result!.entry.isWeighted).toBe(false);
    expect(result!.entry.unitType).toBe('יחידה');
  });
});
