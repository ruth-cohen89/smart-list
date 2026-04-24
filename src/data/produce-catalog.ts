import { normalizeName } from '../utils/normalize';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProduceCategory = 'פרי' | 'ירק' | 'עשבי תיבול';

export interface ProduceCatalogEntry {
  canonicalKey: string;
  canonicalName: string;
  normalizedName: string;
  aliases: string[];
  normalizedAliases: string[];
  category: ProduceCategory;
  unitType: 'ק"ג' | 'יחידה';
  isWeighted: boolean;
  excludeTokens?: string[];
  matchExcludeTokens?: string[];
}

// ---------------------------------------------------------------------------
// Raw seed data
// ---------------------------------------------------------------------------

interface RawProduceEntry {
  canonicalKey: string;
  canonicalName: string;
  aliases: string[];
  category: ProduceCategory;
  unitType: 'ק"ג' | 'יחידה';
  isWeighted: boolean;
  excludeTokens?: string[];
  matchExcludeTokens?: string[];
}

const RAW_CATALOG: RawProduceEntry[] = [
  // ── פירות (Fruits) ──────────────────────────────────────────────────────
  {
    canonicalKey: 'apple',
    canonicalName: 'תפוח',
    aliases: ['תפוח', 'תפוחים', 'תפוח עץ', 'תפוח חרמון', 'תפוח ירוק', 'תפוח אדום', 'תפוח סמית', 'גרני סמית', 'תפוח גולדן', 'תפוח פינק ליידי', 'תפוח פוג\'י', 'תפוח גאלה'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['מיץ', 'חומץ', 'ריבה', 'מיובש'],
  },
  {
    canonicalKey: 'banana',
    canonicalName: 'בננה',
    aliases: ['בננה', 'בננות', 'בננה אורגנית'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['מיובשת', 'צ\'יפס', 'מיץ'],
  },
  {
    canonicalKey: 'orange',
    canonicalName: 'תפוז',
    aliases: ['תפוז', 'תפוזים', 'תפוז שמוטי', 'תפוז נבל', 'תפוז ולנסיה'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['מיץ', 'סירופ'],
  },
  {
    canonicalKey: 'clementine',
    canonicalName: 'קלמנטינה',
    aliases: ['קלמנטינה', 'קלמנטינות', 'מנדרינה', 'מנדרינות'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'grapefruit',
    canonicalName: 'אשכולית',
    aliases: ['אשכולית', 'אשכוליות', 'אשכולית אדומה', 'אשכולית לבנה'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'lemon',
    canonicalName: 'לימון',
    aliases: ['לימון', 'לימונים'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['ארוז', 'מיץ', 'סחוט', 'ריבה', 'סוכריות'],
    matchExcludeTokens: ['מטליות', 'כלים', 'בריח', 'סבון', 'ניקוי'],
  },
  {
    canonicalKey: 'lime',
    canonicalName: 'ליים',
    aliases: ['ליים', 'ליימים'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'pomelo',
    canonicalName: 'פומלה',
    aliases: ['פומלה', 'פומלו', 'פומליות'],
    category: 'פרי',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'grape',
    canonicalName: 'ענבים',
    aliases: ['ענבים', 'ענבים שחורים', 'ענבים ירוקים', 'ענבים אדומים', 'ענבי תמר'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['מיץ', 'יין', 'צימוקים'],
  },
  {
    canonicalKey: 'watermelon',
    canonicalName: 'אבטיח',
    aliases: ['אבטיח', 'אבטיחים'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'melon',
    canonicalName: 'מלון',
    aliases: ['מלון', 'מלונים', 'מלון גליל', 'מלון ענות'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'strawberry',
    canonicalName: 'תות שדה',
    aliases: ['תות', 'תותים', 'תות שדה'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['ריבה', 'מיץ', 'מיובש'],
  },
  {
    canonicalKey: 'blueberry',
    canonicalName: 'אוכמניות',
    aliases: ['אוכמניות', 'אוכמנית'],
    category: 'פרי',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'raspberry',
    canonicalName: 'פטל',
    aliases: ['פטל', 'פטלים'],
    category: 'פרי',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'peach',
    canonicalName: 'אפרסק',
    aliases: ['אפרסק', 'אפרסקים'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['שימורים', 'ריבה', 'מיץ', 'פחית'],
  },
  {
    canonicalKey: 'nectarine',
    canonicalName: 'נקטרינה',
    aliases: ['נקטרינה', 'נקטרינות'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'plum',
    canonicalName: 'שזיף',
    aliases: ['שזיף', 'שזיפים', 'שזיף שחור', 'שזיף אדום'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'cherry',
    canonicalName: 'דובדבן',
    aliases: ['דובדבן', 'דובדבנים'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'apricot',
    canonicalName: 'משמש',
    aliases: ['משמש', 'משמשים'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'pear',
    canonicalName: 'אגס',
    aliases: ['אגס', 'אגסים', 'אגס ספדונה'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'persimmon',
    canonicalName: 'אפרסמון',
    aliases: ['אפרסמון', 'אפרסמונים', 'שרון פרוט'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'pomegranate',
    canonicalName: 'רימון',
    aliases: ['רימון', 'רימונים'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'fig',
    canonicalName: 'תאנה',
    aliases: ['תאנה', 'תאנים'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'date',
    canonicalName: 'תמר',
    aliases: ['תמר', 'תמרים', 'תמר מג\'הול', 'מג\'ול'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'mango',
    canonicalName: 'מנגו',
    aliases: ['מנגו', 'מנגואים'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['מיובש', 'מיץ', 'קפוא'],
  },
  {
    canonicalKey: 'avocado',
    canonicalName: 'אבוקדו',
    aliases: ['אבוקדו', 'אבוקדואים', 'אבוקדו חלק', 'אבוקדו מגורען', 'אבוקדו אטינגר', 'אבוקדו האס', 'אבוקדו פינקרטון'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['ממרח', 'שמן', 'גוואקמולי'],
  },
  {
    canonicalKey: 'pineapple',
    canonicalName: 'אננס',
    aliases: ['אננס', 'אננסים'],
    category: 'פרי',
    unitType: 'יחידה',
    isWeighted: false,
    excludeTokens: ['שימורים', 'מיץ', 'פחית', 'קפוא'],
  },
  {
    canonicalKey: 'kiwi',
    canonicalName: 'קיווי',
    aliases: ['קיווי', 'קיוי'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'passion-fruit',
    canonicalName: 'פסיפלורה',
    aliases: ['פסיפלורה', 'שעונית', 'פסיון פרוט'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'guava',
    canonicalName: 'גויאבה',
    aliases: ['גויאבה', 'גויאבות'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'lychee',
    canonicalName: 'ליצ\'י',
    aliases: ['ליצ\'י', 'ליצי'],
    category: 'פרי',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'coconut',
    canonicalName: 'קוקוס',
    aliases: ['קוקוס', 'קוקוס טרי'],
    category: 'פרי',
    unitType: 'יחידה',
    isWeighted: false,
  },

  // ── ירקות (Vegetables) ──────────────────────────────────────────────────
  {
    canonicalKey: 'tomato',
    canonicalName: 'עגבניה',
    aliases: ['עגבניה', 'עגבניות', 'עגבנייה'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['רסק', 'שימורים', 'קטשופ', 'רוטב', 'מיובשות', 'מרק', 'פחית', 'מיץ', 'בטעם', 'מגי', 'מקולפות', 'גרוסות', 'מרוסקות', 'מרוסק', 'שרי', 'תמר', 'אשכולות', 'חתוכות', 'קוביות', 'מחית', 'תרכיז', 'פסטו'],
  },
  {
    canonicalKey: 'tomato-cherry',
    canonicalName: 'עגבניות שרי',
    aliases: ['עגבניות שרי', 'עגבניית שרי', 'עגבניות שרי מתוקות', 'עגבניות אשכולות'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['רסק', 'שימורים', 'קטשופ', 'רוטב', 'מיובשות', 'מרק', 'פחית', 'מיץ'],
  },
  {
    canonicalKey: 'tomato-date',
    canonicalName: 'עגבניית תמר',
    aliases: ['עגבניית תמר', 'עגבניות תמר'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['רסק', 'שימורים', 'קטשופ', 'רוטב', 'מיובשות', 'מרק', 'פחית', 'מיץ'],
  },
  {
    canonicalKey: 'cucumber',
    canonicalName: 'מלפפון',
    aliases: ['מלפפון', 'מלפפונים', 'מלפפון בייבי'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['חמוצים', 'חמוץ', 'כבוש', 'כבושים', 'מלפפונון', 'במלח', 'בחומץ', 'שימורים', 'משומר', 'כבושה', 'קורנישון'],
    matchExcludeTokens: ['קרם', 'ג\'ל', 'דאודורנט', 'סבון', 'שמפו', 'לחות', 'ניקוי', 'תרסיס', 'בייבי', 'מסכת', 'מרכך', 'רחצה'],
  },
  {
    canonicalKey: 'pepper-red',
    canonicalName: 'גמבה אדומה',
    aliases: ['גמבה אדומה', 'פלפל אדום', 'גמבה'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'ממולא', 'שימורים', 'רוטב'],
  },
  {
    canonicalKey: 'pepper-green',
    canonicalName: 'פלפל ירוק',
    aliases: ['פלפל ירוק', 'פלפל'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'ממולא', 'שימורים', 'רוטב', 'חריף', 'יבש'],
    matchExcludeTokens: ['אנגלי', 'טונה', 'שחור', 'לבן', 'מעושן'],
  },
  {
    canonicalKey: 'pepper-yellow',
    canonicalName: 'גמבה צהובה',
    aliases: ['גמבה צהובה', 'פלפל צהוב'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'ממולא', 'שימורים', 'רוטב'],
  },
  {
    canonicalKey: 'hot-pepper',
    canonicalName: 'פלפל חריף',
    aliases: ['פלפל חריף', 'צ\'ילי', 'פלפל חאלפיניו', 'פלפל חריף ירוק', 'פלפל חריף אדום'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'שימורים', 'רוטב'],
  },
  {
    canonicalKey: 'onion',
    canonicalName: 'בצל',
    aliases: ['בצל', 'בצלים', 'בצל יבש'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['מטוגן', 'אבקת', 'מרק', 'קפוא', 'טבעות'],
  },
  {
    canonicalKey: 'red-onion',
    canonicalName: 'בצל אדום',
    aliases: ['בצל אדום', 'בצל סגול', 'בצל יבש אדום'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'שימורים'],
  },
  {
    canonicalKey: 'green-onion',
    canonicalName: 'בצל ירוק',
    aliases: ['בצל ירוק', 'בצלצל'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'garlic',
    canonicalName: 'שום',
    aliases: ['שום', 'ראש שום', 'שום טרי'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'בשמן', 'קלוי', 'אבקת', 'ממרח', 'שימורים', 'כותש', 'גבישי', 'כתוש'],
  },
  {
    canonicalKey: 'potato',
    canonicalName: 'תפוח אדמה',
    aliases: ['תפוח אדמה', 'תפוחי אדמה', 'תפוד', 'תפודי אדמה'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['פירה', 'צ\'יפס', 'קפוא', 'אדום', 'בורקס'],
  },
  {
    canonicalKey: 'potato-red',
    canonicalName: 'תפוח אדמה אדום',
    aliases: ['תפוח אדמה אדום', 'תפוחי אדמה אדומים'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['פירה', 'צ\'יפס', 'קפוא'],
  },
  {
    canonicalKey: 'sweet-potato',
    canonicalName: 'בטטה',
    aliases: ['בטטה', 'בטטות', 'תפוח אדמה מתוק'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'carrot',
    canonicalName: 'גזר',
    aliases: ['גזר', 'גזרים', 'גזר בייבי'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['צבעוני', 'גמדי', 'מיץ', 'קפוא'],
  },
  {
    canonicalKey: 'zucchini',
    canonicalName: 'קישוא',
    aliases: ['קישוא', 'קישואים', 'קישוא ירוק'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'ממולא', 'שימורים'],
  },
  {
    canonicalKey: 'eggplant',
    canonicalName: 'חציל',
    aliases: ['חציל', 'חצילים', 'חציל שחור'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'שרוף', 'ממרח', 'שימורים', 'על האש', 'צלוי', 'פיקנטי', 'במיונז', 'בטחינה', 'טעם', 'סלט'],
  },
  {
    canonicalKey: 'cabbage',
    canonicalName: 'כרוב',
    aliases: ['כרוב', 'כרוב לבן'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'חמוץ', 'שימורים', 'סלט'],
  },
  {
    canonicalKey: 'red-cabbage',
    canonicalName: 'כרוב סגול',
    aliases: ['כרוב סגול', 'כרוב אדום'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['כבוש', 'חמוץ', 'שימורים', 'סלט'],
  },
  {
    canonicalKey: 'cauliflower',
    canonicalName: 'כרובית',
    aliases: ['כרובית'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'broccoli',
    canonicalName: 'ברוקולי',
    aliases: ['ברוקולי'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
    excludeTokens: ['שניצל'],
  },
  {
    canonicalKey: 'lettuce',
    canonicalName: 'חסה',
    aliases: ['חסה', 'חסה מתולתלת', 'חסה רומית'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
    excludeTokens: ['ערבית', 'אייסברג', 'רוטב'],
  },
  {
    canonicalKey: 'lettuce-arabic',
    canonicalName: 'חסה ערבית',
    aliases: ['חסה ערבית'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'lettuce-iceberg',
    canonicalName: 'חסה אייסברג',
    aliases: ['חסה אייסברג'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'lettuce-lalik',
    canonicalName: 'לאליק',
    aliases: ['לאליק', 'חסה לאליק'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'spinach',
    canonicalName: 'תרד',
    aliases: ['תרד', 'עלי תרד'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'celery',
    canonicalName: 'סלרי',
    aliases: ['סלרי', 'סלרי שורש'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'parsley-root',
    canonicalName: 'שורש פטרוזיליה',
    aliases: ['שורש פטרוזיליה', 'פטרוזיליה שורש'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'leek',
    canonicalName: 'כרישה',
    aliases: ['כרישה', 'כרישות', 'כרשה'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'fennel',
    canonicalName: 'שומר',
    aliases: ['שומר'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'radish',
    canonicalName: 'צנון',
    aliases: ['צנון', 'צנונות', 'צנונית'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'turnip',
    canonicalName: 'לפת',
    aliases: ['לפת'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'beet',
    canonicalName: 'סלק',
    aliases: ['סלק'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'kohlrabi',
    canonicalName: 'קולורבי',
    aliases: ['קולורבי', 'קולרבי'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'corn',
    canonicalName: 'תירס',
    aliases: ['תירס', 'קלח תירס'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'mushroom',
    canonicalName: 'פטריות',
    aliases: ['פטריות', 'פטריות שמפיניון', 'פטריות שיטאקי', 'פטריות פורטובלו', 'שמפיניון', 'פטריה'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'artichoke',
    canonicalName: 'ארטישוק',
    aliases: ['ארטישוק', 'חרשוף'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'asparagus',
    canonicalName: 'אספרגוס',
    aliases: ['אספרגוס'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'green-beans',
    canonicalName: 'שעועית ירוקה',
    aliases: ['שעועית ירוקה', 'שעועית'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'peas',
    canonicalName: 'אפונה',
    aliases: ['אפונה', 'אפונה טרייה', 'אפונית'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'pumpkin',
    canonicalName: 'דלעת',
    aliases: ['דלעת', 'דלורית', 'דלעת ערמונים'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'okra',
    canonicalName: 'במיה',
    aliases: ['במיה'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },
  {
    canonicalKey: 'chard',
    canonicalName: 'מנגולד',
    aliases: ['מנגולד', 'עלי מנגולד', 'סלק עלים'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'kale',
    canonicalName: 'קייל',
    aliases: ['קייל', 'כרוב עלים'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'arugula',
    canonicalName: 'רוקט',
    aliases: ['רוקט', 'רוקולה', 'עלי רוקט'],
    category: 'ירק',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'ginger',
    canonicalName: 'ג\'ינג\'ר',
    aliases: ['ג\'ינג\'ר', 'גינגר', 'זנגביל'],
    category: 'ירק',
    unitType: 'ק"ג',
    isWeighted: true,
  },

  // ── עשבי תיבול (Herbs) ──────────────────────────────────────────────────
  {
    canonicalKey: 'parsley',
    canonicalName: 'פטרוזיליה',
    aliases: ['פטרוזיליה'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'cilantro',
    canonicalName: 'כוסברה',
    aliases: ['כוסברה', 'כוזברה'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'dill',
    canonicalName: 'שמיר',
    aliases: ['שמיר'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'mint',
    canonicalName: 'נענע',
    aliases: ['נענע', 'נענה'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'basil',
    canonicalName: 'בזיליקום',
    aliases: ['בזיליקום', 'ריחן'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'rosemary',
    canonicalName: 'רוזמרין',
    aliases: ['רוזמרין'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'thyme',
    canonicalName: 'קורנית',
    aliases: ['קורנית', 'טימין'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'sage',
    canonicalName: 'מרווה',
    aliases: ['מרווה'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'chives',
    canonicalName: 'עירית',
    aliases: ['עירית'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'tarragon',
    canonicalName: 'טרגון',
    aliases: ['טרגון'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'oregano',
    canonicalName: 'אורגנו',
    aliases: ['אורגנו', 'אורגנו טרי'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
  {
    canonicalKey: 'lemongrass',
    canonicalName: 'עשב לימון',
    aliases: ['עשב לימון', 'למון גראס'],
    category: 'עשבי תיבול',
    unitType: 'יחידה',
    isWeighted: false,
  },
];

// ---------------------------------------------------------------------------
// Build indexed catalog at module load
// ---------------------------------------------------------------------------

function buildCatalog(): {
  entries: ProduceCatalogEntry[];
  aliasIndex: Map<string, ProduceCatalogEntry>;
} {
  const entries: ProduceCatalogEntry[] = [];
  const aliasIndex = new Map<string, ProduceCatalogEntry>();

  for (const raw of RAW_CATALOG) {
    const normalizedAliases = raw.aliases.map((a) => normalizeName(a));
    const entry: ProduceCatalogEntry = {
      ...raw,
      normalizedName: normalizeName(raw.canonicalName),
      normalizedAliases,
    };
    entries.push(entry);

    for (const alias of normalizedAliases) {
      if (alias) {
        aliasIndex.set(alias, entry);
      }
    }
  }

  return { entries, aliasIndex };
}

const { entries: PRODUCE_CATALOG, aliasIndex: ALIAS_INDEX } = buildCatalog();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export { PRODUCE_CATALOG };

// ---------------------------------------------------------------------------
// Produce-matching token lists — used by price-comparison ranking
// ---------------------------------------------------------------------------

/**
 * Hard-exclude: products whose normalizedName contains any of these tokens
 * can never be fresh produce, regardless of what global product they're linked to.
 *
 * Covers frozen forms explicitly because Hebrew has multiple conjugations
 * (קפוא/קפואה/קפואים/קפואות, מוקפא/מוקפאת/מוקפאים/מוקפאות) and a single
 * token check on "קפוא" would miss "כרובית מוקפאת", "תירס קפואים", etc.
 */
export const PRODUCE_HARD_EXCLUDE_TOKENS: readonly string[] = [
  // Processed/snack foods
  'בורקס', 'תפוציפס', 'חטיף', 'ממרח', 'פיקנטי', 'בטחינה', 'במיונז', 'כתוש', 'גבישי', 'רסק', 'זרעי',
  // Frozen — all Hebrew conjugations (masculine/feminine, singular/plural, pa'al/huf'al)
  'קפוא', 'קפואה', 'קפואים', 'קפואות',
  'מוקפא', 'מוקפאת', 'מוקפאים', 'מוקפאות',
  // Canned "whole X" — almost always canned in Israeli retail context
  'שלמות',
  // Cosmetics / cleaning (belt-and-suspenders alongside matchExcludeTokens)
  'ריח', 'בישום',
];

/**
 * Subtype tokens: products containing any of these are a specific variety/variant.
 * When the user's query does NOT itself contain a subtype token (they asked for
 * plain "גזר", not "גזר סגול"), we prefer base candidates.  If only subtype
 * candidates remain, return null rather than a wrong-variant match.
 *
 * Color words (סגול, צהוב) are included because in Israeli retail:
 *   גזר סגול = purple carrot (specific variety)
 *   גזר צהוב = yellow carrot (specific variety)
 * When the user asked for "גזר" they almost certainly want the standard orange carrot.
 * For canonical entries like "גמבה אדומה" the entry's alias already includes "אדום",
 * so inputContainsSubtype=true and subtype filtering is skipped correctly.
 */
export const PRODUCE_SUBTYPE_TOKENS: readonly string[] = [
  // Named varieties
  'שרי', 'בייבי', 'בלאדי', 'פרסי',
  // Specific colors that indicate a non-default variety
  'סגול', 'צהוב',
  // Packaging / processing state
  'חריף', 'יבש',
];

export interface ProduceMatchResult {
  entry: ProduceCatalogEntry;
  matchedAlias: string;
}

/**
 * Match a normalized product name against the produce catalog.
 *
 * Rules:
 * - Match only by exact normalized alias lookup
 * - No aggressive fuzzy — deterministic only
 * - Tries full name first, then checks if any alias is contained in the name
 */
export function matchProduceCanonical(normalizedName: string): ProduceMatchResult | null {
  if (!normalizedName) return null;

  const isMatchExcluded = (entry: ProduceCatalogEntry) =>
    (entry.matchExcludeTokens ?? []).some((t) => normalizedName.includes(t));

  // 1. Exact full-name match against aliases
  const exactMatch = ALIAS_INDEX.get(normalizedName);
  if (exactMatch && !isMatchExcluded(exactMatch)) {
    return { entry: exactMatch, matchedAlias: normalizedName };
  }

  // 2. Check if the input contains an alias as a whole token sequence
  //    e.g. "עגבניות שרי מתוקות מארז" should match "עגבניות שרי מתוקות"
  //    Longest alias first to prefer more specific matches
  const sortedAliases = [...ALIAS_INDEX.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [alias, entry] of sortedAliases) {
    if (alias.length < 2) continue;
    if (isMatchExcluded(entry)) continue;

    // The alias must appear as a whole-word boundary substring
    const idx = normalizedName.indexOf(alias);
    if (idx === -1) continue;

    const before = idx === 0 || normalizedName[idx - 1] === ' ';
    const after =
      idx + alias.length === normalizedName.length ||
      normalizedName[idx + alias.length] === ' ';

    if (before && after) {
      return { entry, matchedAlias: alias };
    }
  }

  return null;
}
