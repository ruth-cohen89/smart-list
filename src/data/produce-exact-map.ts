import type { ChainId } from '../models/chain-product.model';
import { normalizeName } from '../utils/normalize';

// Maps canonicalKey → chainId → allowed normalizedName values from the chain's DB.
// Produce items use ONLY this map. If a key/chain pair is absent → null (no match).
// Add entries using the exact normalizedName values as they appear in the chain's DB.
const RAW_MAP: Record<string, Partial<Record<ChainId, string[]>>> = {
  tomato: {
    'rami-levy': ['עגבניה'],
    'tiv-taam': ['עגבניות'],
    'machsanei-hashuk': ['עגבניה'],
    shufersal: ['עגבניה', 'עגבניות'],
  },
  cucumber: {
    'tiv-taam': ['מלפפונים'],
    'rami-levy': ['מלפפון'],
    'machsanei-hashuk': ['מלפפון'],
    shufersal: ['מלפפון'],
  },
  carrot: {
    'tiv-taam': ['גזר'],
    'rami-levy': ['גזר ארוז'],
    'machsanei-hashuk': ['גזר ארוז'],
    shufersal: ['גזר ארוז שופרסל'],
  },
  'sweet-potato': {
    'tiv-taam': ['בטטה'],
    'rami-levy': ['בטטה'],
    'machsanei-hashuk': ['בטטה'],
    shufersal: ['בטטות ארוזות'],
  },
  potato: {
    'tiv-taam': ['תפו"א לבן ברשת'],
    'rami-levy': ['תפוח אדמה לבן ארוז'],
    'machsanei-hashuk': ['תפוח אדמה לבן ארוז'],
    shufersal: ['תפוח אדמה לבן ארוז'],
  },
  'potato-red': {
    'tiv-taam': [], // no clear fresh candidate
    'rami-levy': ['תפוח אדמה אדום ארוז'],
    'machsanei-hashuk': ['תפוח אדמה אדום'],
    shufersal: ['תפוח אדמה אדום ארוז'],
  },
  onion: {
    'tiv-taam': ['בצל יבש'],
    'rami-levy': ['בצל יבש'],
    'machsanei-hashuk': ['בצל יבש'],
    shufersal: ['בצל יבש'],
  },
  'red-onion': {
    'tiv-taam': ['בצל אדום'],
    'rami-levy': ['בצל אדום'],
    'machsanei-hashuk': ['בצל אדום'],
    shufersal: ['בצל יבש אדום ארוז'],
  },
  garlic: {
    'tiv-taam': ['שום ברשת'],
    'rami-levy': ['מארז שום יבש 4 יחידות'],
    'machsanei-hashuk': ['שום ארוז'],
    shufersal: ['מארז שום יבש'],
  },
  'pepper-red': {
    'tiv-taam': ['פלפל אדום'],
    'rami-levy': ['פלפל אדום'],
    'machsanei-hashuk': ['גמבה אדומה'],
    shufersal: ['פלפל אדום'],
  },
  'pepper-green': {
    'tiv-taam': ['פלפל ירוק'],
    'rami-levy': ['פלפל ירוק כהה'],
    'machsanei-hashuk': ['פלפל כהה'],
    shufersal: ['פלפל ירוק בהיר'],
  },
  'pepper-yellow': {
    'tiv-taam': ['פלפל צהוב'],
    'rami-levy': ['פלפל צהוב'],
    'machsanei-hashuk': ['פלפל בהיר'],
    shufersal: ['פלפל צהוב'],
  },
  zucchini: {
    'tiv-taam': ['קישואים'], // was קשואים — typo fixed
    'rami-levy': ['קישוא ירוק'],
    'machsanei-hashuk': ['קישואים'],
    shufersal: ['קישוא טרי ארוז'],
  },
  eggplant: {
    'tiv-taam': ['חצילים'],
    'rami-levy': ['חציל'],
    'machsanei-hashuk': ['חציל'],
    shufersal: ['חציל'],
  },
  cabbage: {
    'tiv-taam': ['כרוב לבן'],
    'rami-levy': ['כרוב לבן'],
    'machsanei-hashuk': ['כרוב לבן'],
    shufersal: ['כרוב לבן'],
  },
  'red-cabbage': {
    'tiv-taam': ['כרוב אדום'],
    'rami-levy': ['כרוב אדום'],
    'machsanei-hashuk': ['כרוב אדום'],
    shufersal: ['כרוב אדום'],
  },
  cauliflower: {
    'tiv-taam': ['כרובית'],
    'rami-levy': ['כרובית', 'כרובית ארוזה', "כרובית ארוזה יח' רמי לוי"],
    'machsanei-hashuk': ['כרובית'],
    shufersal: ['כרובית ארוזה'],
  },
  broccoli: {
    'tiv-taam': ['ברוקולי'],
    'rami-levy': [
      'ברוקולי חסלט',
      'בייבי ברוקולי חוות תקוע',
      'ברוקולי יבולי הכפר מהדרין',
      'ברוקולי מיני ארוז א.אדמה',
    ],
    'machsanei-hashuk': ['ברוקולי ארוז יחידה'],
    shufersal: ['ברוקולי ארוז כ-350גרם'],
  },
  'lettuce-arabic': {
    'tiv-taam': ['חסה ערבית'],
    'rami-levy': ['חסה ערבית שקית חסלט', 'חסה ערבית מהדרין רמי לוי'],
    'machsanei-hashuk': ['חסה ערבית'],
    shufersal: ['מארז עלי חסה ערבית 250ג'],
  },
  'lettuce-lalik': {
    'tiv-taam': ['חסה לאליק הידרופונית'],
    'rami-levy': ['חסה לאליק א.אדמה'],
    'machsanei-hashuk': ['חסה לליק'],
    shufersal: ['חסה לאליק', 'חסה לאליק הידרופונית'],
  },
  'tomato-cherry': {
    'tiv-taam': ['עגבניות שרי'],
    'rami-levy': ['עגבניות שרי לובלו רמי לוי'],
    'machsanei-hashuk': ['עגבניות שרי ארוז', 'עגבניות שרי קלמרים', 'עגבניות שרי תמר אדום ארוז'],
    shufersal: ['מארז עגבניות שרי לובלו', 'עגבניות שרי מנומר460ג'],
  },
  'hot-pepper': {
    'tiv-taam': ['פלפל חריף'],
    'rami-levy': ['פלפל חריף'],
    'machsanei-hashuk': ['פלפל חריף ירוק'],
    shufersal: ["מארז פלפל צ'ילי חריף יח'", 'פלפל חריף ארוז 6יחידות'],
  },
  lemon: {
    'tiv-taam': ['לימון'],
    'rami-levy': ['לימון'],
    'machsanei-hashuk': ['לימון'],
    shufersal: ['לימון'],
  },
  banana: {
    'rami-levy': ['בננה'],
    shufersal: ['בננה מובחרת'],
    'machsanei-hashuk': ['בננה'],
    'tiv-taam': ['בננות'],
  },
  orange: {
    'rami-levy': ['תפוז'],
    'tiv-taam': ['תפוזים', 'תפוז ברשת'],
    shufersal: ['תפוזים', 'תפוז טרי ארוז'],
    'machsanei-hashuk': ['תפוז תבורי'],
  },
  clementine: { 'tiv-taam': ['קלמנטינה'], shufersal: ['קלמנטינה אור'] },
  pear: {
    'rami-levy': ['אגס'],
    shufersal: ['אגס ארוז 8 יחידות'],
    'machsanei-hashuk': ['אגסים'],
    'tiv-taam': ['אגס אדום', 'אגסים'],
  },
  grape: {
    'rami-levy': ['ענבים ירוקים'],
    'tiv-taam': ['ענבים ירוקים'],
    shufersal: ['ענבים ירוקים'],
    'machsanei-hashuk': ['ענבים לבן'],
  },
  strawberry: {
    shufersal: ['תות שדה ארוז יחידה'],
    'machsanei-hashuk': ['תות שדה מארז'],
  },

  watermelon: {
    'rami-levy': ['אבטיח'],
    'tiv-taam': ['אבטיח'],
    shufersal: ['אבטיח אורגני במשקל', 'אבטיח'],
    'machsanei-hashuk': ['אבטיח'],
  },
  melon: {
    'rami-levy': ['מלון'],
    'tiv-taam': ['מלון'],
    shufersal: ['מלון גסטין', 'מלון גסמין'],
    'machsanei-hashuk': ['מלון'],
  },
  mango: { shufersal: ['מנגו שלי'] },
  pineapple: {
    'rami-levy': ['אננס מובחר'],
    'tiv-taam': ['אננס טרי'],
    shufersal: ['אננס טרי יחידה'],
    'machsanei-hashuk': ['אננס'],
  }, // shufersal: unit-based (isWeighted=false)
  peach: {
    'rami-levy': ['אפרסק'],
    'tiv-taam': ['אפרסק'],
    shufersal: ['אפרסק ארוז', 'אפרסק'],
  },
  nectarine: {
    'rami-levy': ['נקטרינה'],
    'tiv-taam': ['נקטרינה'],
    shufersal: ['נקטרינה ארוז', 'נקטרינה ארוזה'],
  },
  kiwi: {
    'rami-levy': ['קיווי'],
    'tiv-taam': ['קיווי'],
    shufersal: ['מארז קיווי ירוק', 'קיווי ירוק'],
    'machsanei-hashuk': ['קיווי'],
  },
  avocado: {
    'rami-levy': ['אבוקדו'],
    'tiv-taam': ['אבוקדו', 'אבוקדו בשל'],
    shufersal: ['מארז אבוקדו בשל', 'אבוקדו בשל'],
    'machsanei-hashuk': ['אבוקדו'],
  },
  // apple: intentionally absent for Shufersal and Machsanei Hashuk — no confirmed DB product yet
  // orange, clementine, strawberry, mango, peach, nectarine: absent for Machsanei Hashuk — no confirmed DB product yet
};

// Pre-normalize all values at module load so comparisons are safe.
export const PRODUCE_CHAIN_EXACT_MAP: Record<
  string,
  Partial<Record<ChainId, Set<string>>>
> = Object.fromEntries(
  Object.entries(RAW_MAP).map(([key, chainMap]) => [
    key,
    Object.fromEntries(
      (Object.entries(chainMap) as [ChainId, string[]][]).map(([chainId, names]) => [
        chainId,
        new Set(names.map(normalizeName)),
      ]),
    ),
  ]),
);
