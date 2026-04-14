import { normalizeForMatching, tokenize } from '../../../src/utils/normalize';

describe('normalizeForMatching – unit normalization regression', () => {
  it('normalizes "גר" / "גרם" after digits', () => {
    expect(normalizeForMatching('חמאה 200גר')).toContain('200g');
    expect(normalizeForMatching('שיבולת שועל 500 גרם')).toContain('500g');
  });

  it('does not corrupt Hebrew words containing "גר"', () => {
    const result = normalizeForMatching('גבינה בולגרית 5%');
    expect(result).toContain('בולגרית');
    expect(result).not.toContain('בולgית');
  });

  it('does not corrupt "גרנולה"', () => {
    expect(normalizeForMatching('גרנולה שוקולד')).toContain('גרנולה');
  });
});

describe('tokenize', () => {
  it('filters single-char non-digit tokens', () => {
    expect(tokenize('חלב 3% 1 liter')).toEqual(['חלב', '3%', '1', 'liter']);
  });
});
