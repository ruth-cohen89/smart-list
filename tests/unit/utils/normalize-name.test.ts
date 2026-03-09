import { normalizeName } from '../../../src/utils/normalize';

describe('normalizeName', () => {
  it('trims surrounding whitespace and lowercases English text', () => {
    expect(normalizeName('  Hello World  ')).toBe('hello world');
  });

  it('preserves Hebrew characters and lowercases surrounding Latin letters', () => {
    expect(normalizeName('חלב תנובה')).toBe('חלב תנובה');
  });

  it('strips quote-like characters (single quote, double quote, geresh)', () => {
    expect(normalizeName("גבינה 'בולגרית'")).toBe('גבינה בולגרית');
  });

  it('collapses multiple consecutive spaces into one', () => {
    expect(normalizeName('שוקולד  מריר')).toBe('שוקולד מריר');
  });

  it('replaces non-letter non-digit punctuation with a space', () => {
    // '&' is neither a letter nor a digit → replaced with space, then collapsed
    expect(normalizeName('Milk & Honey')).toBe('milk honey');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeName('')).toBe('');
  });
});
