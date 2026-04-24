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
    shufersal: ['עגבניה'],
  },
  cucumber: {
    'tiv-taam': ['מלפפונים'],
    'rami-levy': ['מלפפון'],
    'machsanei-hashuk': ['מלפפון'],
    shufersal: ['מלפפון'],
  },
  carrot: {
    'tiv-taam': ['גזר ארוז'],
    'rami-levy': ['גזר ארוז'],
    'machsanei-hashuk': ['גזר ארוז'],
    shufersal: ['גזר ארוז'],
  },
  'sweet-potato': {
    'tiv-taam': ['בטטה'],
    'rami-levy': ['בטטה'],
    'machsanei-hashuk': ['בטטה'],
    shufersal: ['בטטה'],
  },
  potato: {
    'tiv-taam': ['תפו"א לבן ברשת'],
    'rami-levy': ['תפוח אדמה לבן ארוז'],
    'machsanei-hashuk': ['שק תפוח אדמה לבן'],
    shufersal: ['תפוח אדמה לבן ארוז'],
  },
  'potato-red': {
    'tiv-taam': ['תפוח אדמה אדום'],
    'rami-levy': ['תפוח אדמה אדום ארוז'],
    'machsanei-hashuk': ['שק תפוח אדמה אדום'],
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
    shufersal: ['בצל יבש אדום'],
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
    'tiv-taam': [],
    'rami-levy': ['פלפל ירוק כהה'],
    'machsanei-hashuk': ['פלפל כהה'],
    shufersal: ['פלפל ירוק כהה'],
  },
  'pepper-yellow': {
    'tiv-taam': [],
    'rami-levy': ['פלפל צהוב'],
    'machsanei-hashuk': ['פלפל בהיר'],
    shufersal: ['פלפל צהוב'],
  },
  zucchini: {
    'tiv-taam': ['קשואים'],
    'rami-levy': ['קישוא ירוק'],
    'machsanei-hashuk': ['קישואים'],
    shufersal: ['מארז קישוא זוקיני'],
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
    'rami-levy': [],
    'machsanei-hashuk': ['כרובית בתפזורת'],
    shufersal: ['כרובית'],
  },
  broccoli: {
    'tiv-taam': ['ברוקולי'],
    'rami-levy': [],
    'machsanei-hashuk': ['ברוקולי מובחר'],
    shufersal: ['ברוקולי ארוז'],
  },
  'lettuce-arabic': {
    'tiv-taam': ['חסה ערבית'],
    'rami-levy': ['חסה'],
    'machsanei-hashuk': ['חסה ערבית'],
    shufersal: ['חסה ערבית'],
  },
  'lettuce-lalik': {
    'tiv-taam': ['חסה לאליק הידרופונית'],
    'rami-levy': ['חסה לאליק מהדרין רמי לוי'],
    'machsanei-hashuk': ['חסה לליק'],
    shufersal: ['מארז חסה לאליק הידרופונית'],
  },
  'tomato-cherry': {
    'tiv-taam': ['עגבניות שרי'],
    'rami-levy': ['עגבניות שרי לובלו רמי לוי'],
    'machsanei-hashuk': ['עגבניות שרי'],
    shufersal: ['מארז עגבניות שרי - תמר'],
  },
  'hot-pepper': {
    'tiv-taam': ['פלפל חריף'],
    'rami-levy': ['פלפל חריף'],
    'machsanei-hashuk': ['פלפל חריף'],
    shufersal: ['פלפל חריף'],
  },
  lemon: {
    'tiv-taam': ['לימון'],
    'rami-levy': ['לימון'],
    'machsanei-hashuk': ['לימון'],
    shufersal: ['לימון'],
  },
};

// Pre-normalize all values at module load so comparisons are safe.
export const PRODUCE_CHAIN_EXACT_MAP: Record<string, Partial<Record<ChainId, Set<string>>>> =
  Object.fromEntries(
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
