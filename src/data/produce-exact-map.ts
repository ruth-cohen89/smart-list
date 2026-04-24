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
    shufersal: [],                                    // no clear fresh candidate
  },
  cucumber: {
    'tiv-taam': ['מלפפונים'],
    'rami-levy': ['מלפפון'],
    'machsanei-hashuk': ['מלפפון'],
    shufersal: [],                                    // no clear fresh candidate
  },
  carrot: {
    'tiv-taam': [],                                   // no clear fresh candidate
    'rami-levy': ['גזר ארוז'],
    'machsanei-hashuk': ['גזר ארוז'],
    shufersal: [],                                    // no clear fresh candidate
  },
  'sweet-potato': {
    'tiv-taam': ['בטטה'],
    'rami-levy': ['בטטה'],
    'machsanei-hashuk': ['בטטה'],
    shufersal: [],                                    // no clear fresh candidate
  },
  potato: {
    'tiv-taam': ['תפו"א לבן ברשת'],
    'rami-levy': ['תפוח אדמה לבן ארוז'],
    'machsanei-hashuk': ['תפוח אדמה לבן ארוז'],
    shufersal: ['תפוח אדמה לבן ארוז'],
  },
  'potato-red': {
    'tiv-taam': [],                                   // no clear fresh candidate
    'rami-levy': ['תפוח אדמה אדום ארוז'],
    'machsanei-hashuk': ['תפוח אדמה אדום'],
    shufersal: [],                                    // no clear fresh candidate
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
    'tiv-taam': [],
    'rami-levy': ['פלפל ירוק כהה'],
    'machsanei-hashuk': ['פלפל כהה'],
    shufersal: [],                                    // no clear fresh candidate
  },
  'pepper-yellow': {
    'tiv-taam': [],
    'rami-levy': ['פלפל צהוב'],
    'machsanei-hashuk': ['פלפל בהיר'],
    shufersal: ['פלפל צהוב'],
  },
  zucchini: {
    'tiv-taam': ['קישואים'],                         // was קשואים — typo fixed
    'rami-levy': ['קישוא ירוק'],
    'machsanei-hashuk': ['קישואים'],
    shufersal: [],                                    // no clear fresh candidate
  },
  eggplant: {
    'tiv-taam': ['חצילים'],
    'rami-levy': ['חציל'],
    'machsanei-hashuk': ['חציל'],
    shufersal: [],                                    // no clear fresh candidate
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
    'rami-levy': ['ברוקולי חסלט', 'בייבי ברוקולי חוות תקוע', 'ברוקולי יבולי הכפר מהדרין', 'ברוקולי מיני ארוז א.אדמה'],
    'machsanei-hashuk': ['ברוקולי ארוז יחידה'],
    shufersal: ['ברוקולי אורגני מארז'],
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
    shufersal: [],                                    // no clear fresh candidate
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
