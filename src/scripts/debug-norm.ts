import { normalizeForMatching, tokenize } from '../utils/normalize';

const names = [
  'גבינה בולגרית 5%',
  'בולגרית מעודנת 5% 250 גר',
  'גב.בולגרית מלוחה 175גרם',
  'בולגרית פיראוס  %24 שקיל',
  'חלב 3% 1 ליטר',
  'שיבולת שועל 500 גרם',
  'חמאה 200גר',
];

console.log('normalizeForMatching:');
for (const n of names) {
  const result = normalizeForMatching(n);
  console.log(`  "${n}" → "${result}" → tokens: [${tokenize(result).join(', ')}]`);
}
