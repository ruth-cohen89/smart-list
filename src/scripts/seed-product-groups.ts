/**
 * Seed script: populates productGroups and productVariants collections.
 *
 * Usage:
 *   npx ts-node src/scripts/seed-product-groups.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import { normalizeName } from '../utils/normalize';
import { ProductGroupRepository } from '../repositories/product-group.repository';
import { ProductVariantRepository } from '../repositories/product-variant.repository';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

interface VariantSeed {
  name: string;
  keywords: string[];
  includeKeywords?: string[];
  excludeKeywords?: string[];
}

interface GroupSeed {
  name: string;
  department: string;
  category: string;
  selectionMode: 'canonical' | 'sku';
  keywords: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  variants?: VariantSeed[];
}

const SEED_GROUPS: GroupSeed[] = [
  // ─── חלב ומוצרי חלב ──────────────────────────────────────────────
  {
    name: 'חלב 3%',
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['חלב', '3%', 'שומן', 'טרי', 'מועשר', 'פרה', 'ליטר', 'בקרטון', 'בקבוק'],
    includeKeywords: ['חלב', '3%'],
    excludeKeywords: [
      '1%', 'ללא לקטוז', 'סויה', 'שקדים', 'קוקוס', 'שוקו',
      'שוקולד', 'ריבת', 'חטיף', 'לוז', 'טעם', 'אבקה', 'חלבון',
      'מעדן', 'משקה', 'אנרגיה', 'פודינג', 'מילקי',
      'דנונה', 'יוגורט', 'קוטג', 'שמנת', 'גבינה', 'עוגה',
      'קפה', 'קקאו', 'וניל', 'תות', 'בננה', 'מוקה',
    ],
  },
  {
    name: 'חלב 1%',
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['חלב', '1%', 'דל שומן', 'טרי', 'מועשר', 'פרה', 'ליטר', 'בקרטון', 'בקבוק'],
    includeKeywords: ['חלב', '1%'],
    excludeKeywords: [
      '3%', 'ללא לקטוז', 'סויה', 'שקדים', 'קוקוס', 'שוקו',
      'שוקולד', 'ריבת', 'חטיף', 'לוז', 'טעם', 'אבקה', 'חלבון',
      'מעדן', 'משקה', 'אנרגיה', 'פודינג', 'מילקי',
      'דנונה', 'יוגורט', 'קוטג', 'שמנת', 'גבינה', 'עוגה',
      'קפה', 'קקאו', 'וניל', 'תות', 'בננה', 'מוקה',
    ],
  },
  {
    name: "קוטג' 5%",
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['קוטג', '5%', 'גבינה', 'לבנה'],
    includeKeywords: ['קוטג', '5%'],
    excludeKeywords: ['3%', '9%', 'ללא לקטוז', 'שוקולד', 'פירות', 'ממרח'],
  },
  {
    name: 'שמנת מתוקה',
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['שמנת', 'מתוקה', 'להקצפה'],
    includeKeywords: ['שמנת', 'מתוקה'],
    excludeKeywords: ['חמוצה', 'בישול', 'שוקולד', 'קרם'],
  },
  {
    name: 'שמנת חמוצה',
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['שמנת', 'חמוצה'],
    includeKeywords: ['שמנת', 'חמוצה'],
    excludeKeywords: ['מתוקה', 'להקצפה'],
  },
  {
    name: 'יוגורט טבעי',
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['יוגורט', 'טבעי', 'לבן'],
    includeKeywords: ['יוגורט'],
    excludeKeywords: ['פירות', 'שתייה', 'דנונה', 'מילקי', 'שוקולד', 'וניל', 'תות', 'בננה', 'מנגו', 'אפרסק'],
  },
  {
    name: 'חמאה',
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['חמאה', 'תבנית'],
    includeKeywords: ['חמאה'],
    excludeKeywords: ['מרגרינה', 'ממרח'],
  },
  {
    name: 'גבינה צהובה 28%',
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['גבינה', 'צהובה', '28%', 'עמק', 'פרוסות'],
    includeKeywords: ['גבינה', 'צהובה'],
    excludeKeywords: ['לבנה', 'קוטג', 'שמנת', 'מוצרלה'],
  },
  {
    name: 'גבינה לבנה',
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['גבינה', 'לבנה', 'שמנת', '5%'],
    includeKeywords: ['גבינה', 'לבנה'],
    excludeKeywords: ['צהובה', 'קוטג', 'מוצרלה', 'בולגרית'],
  },
  {
    name: 'מוצרלה',
    department: 'מזון',
    category: 'חלב ומוצרי חלב',
    selectionMode: 'canonical',
    keywords: ['מוצרלה', 'גבינה', 'פיצה'],
    includeKeywords: ['מוצרלה'],
    excludeKeywords: ['צהובה', 'לבנה', 'קוטג'],
  },

  // ─── ביצים ────────────────────────────────────────────────────────
  {
    name: 'ביצים',
    department: 'מזון',
    category: 'ביצים',
    selectionMode: 'canonical',
    keywords: ['ביצים', 'ביצה', 'גודל', 'L', 'M', 'תבנית'],
    includeKeywords: ['ביצים'],
    excludeKeywords: ['שוקולד', 'הפתעה', 'אבקה', 'פורס', 'אטריות', 'מצות', 'מקרוני', 'פסטה', 'נודלס', 'מיונז', 'פתיתי'],
    variants: [
      {
        name: 'תבנית 12',
        keywords: ['12', 'תריסר'],
        includeKeywords: ['12'],
        excludeKeywords: ['30'],
      },
      {
        name: 'תבנית 30',
        keywords: ['30', 'מגש'],
        includeKeywords: ['30'],
        excludeKeywords: ['12'],
      },
    ],
  },

  // ─── לחם ומאפים ───────────────────────────────────────────────────
  {
    name: 'לחם אחיד',
    department: 'מזון',
    category: 'לחם ומאפים',
    selectionMode: 'canonical',
    keywords: ['לחם', 'אחיד', 'פרוס', 'לבן'],
    includeKeywords: ['לחם', 'אחיד'],
    excludeKeywords: ['מלא', 'קמח מלא', 'שיפון', 'כוסמין'],
  },
  {
    name: 'לחם מלא',
    department: 'מזון',
    category: 'לחם ומאפים',
    selectionMode: 'canonical',
    keywords: ['לחם', 'מלא', 'קמח מלא', 'פרוס'],
    includeKeywords: ['לחם', 'מלא'],
    excludeKeywords: ['אחיד', 'לבן', 'שיפון'],
  },
  {
    name: 'פיתות',
    department: 'מזון',
    category: 'לחם ומאפים',
    selectionMode: 'canonical',
    keywords: ['פיתה', 'פיתות', 'לבנות'],
    includeKeywords: ['פיתה', 'פיתות'],
    excludeKeywords: ['טורטיה', 'לאפה'],
  },
  {
    name: 'טורטיה',
    department: 'מזון',
    category: 'לחם ומאפים',
    selectionMode: 'canonical',
    keywords: ['טורטיה', 'טורטיות', 'עטיפה', 'ראפ'],
    includeKeywords: ['טורטיה'],
    excludeKeywords: ['פיתה', 'צ\'יפס', 'נאצ\'וס'],
  },

  // ─── בשר ועוף ─────────────────────────────────────────────────────
  {
    name: 'חזה עוף טרי',
    department: 'מזון',
    category: 'בשר ועוף',
    selectionMode: 'canonical',
    keywords: ['חזה', 'עוף', 'טרי', 'פילה'],
    includeKeywords: ['חזה', 'עוף'],
    excludeKeywords: ['קפוא', 'טחון', 'שניצל', 'נקניק', 'כרעיים', 'שוקיים', 'כנפיים'],
    variants: [
      {
        name: 'רגיל',
        keywords: ['רגיל'],
        includeKeywords: [],
        excludeKeywords: ['אורגני'],
      },
      {
        name: 'ארוז מראש',
        keywords: ['ארוז', 'אטום'],
        includeKeywords: ['ארוז'],
        excludeKeywords: [],
      },
    ],
  },
  {
    name: 'כרעיים עוף',
    department: 'מזון',
    category: 'בשר ועוף',
    selectionMode: 'canonical',
    keywords: ['כרעיים', 'עוף', 'שוקיים', 'טרי'],
    includeKeywords: ['כרעיים', 'עוף'],
    excludeKeywords: ['חזה', 'כנפיים', 'שניצל', 'קפוא'],
  },
  {
    name: 'בשר טחון',
    department: 'מזון',
    category: 'בשר ועוף',
    selectionMode: 'canonical',
    keywords: ['בשר', 'טחון', 'בקר'],
    includeKeywords: ['בשר', 'טחון'],
    excludeKeywords: ['עוף', 'חזה', 'שניצל', 'נקניק'],
  },
  {
    name: 'שניצל עוף',
    department: 'מזון',
    category: 'בשר ועוף',
    selectionMode: 'canonical',
    keywords: ['שניצל', 'עוף', 'מטוגן', 'מוכן'],
    includeKeywords: ['שניצל'],
    excludeKeywords: ['חזה', 'כרעיים', 'בקר'],
  },
  {
    name: 'נקניקיות',
    department: 'מזון',
    category: 'בשר ועוף',
    selectionMode: 'sku',
    keywords: ['נקניקיות', 'נקניק', 'נקניקייה', 'הודו', 'עוף'],
    includeKeywords: ['נקניק'],
    excludeKeywords: ['חזה', 'שניצל', 'בשר'],
  },

  // ─── ירקות ────────────────────────────────────────────────────────
  {
    name: 'עגבניות',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['עגבניה', 'עגבניות', 'עגבנייה', 'אדומות', 'שרי', 'טריות'],
    includeKeywords: ['עגבני'],
    excludeKeywords: ['רסק', 'שימורים', 'קטשופ', 'רוטב', 'מיובשות', 'מרק', 'פחית'],
  },
  {
    name: 'מלפפון',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['מלפפון', 'מלפפונים', 'ירוק'],
    includeKeywords: ['מלפפון', 'מלפפונים'],
    excludeKeywords: ['חמוצים', 'כבוש', 'מלפפונון'],
  },
  {
    name: 'בצל יבש',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['בצל', 'יבש', 'זהוב'],
    includeKeywords: ['בצל'],
    excludeKeywords: ['ירוק', 'סגול', 'אדום', 'טבעות', 'קפוא'],
  },
  {
    name: 'תפוחי אדמה',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['תפוחי', 'אדמה', 'תפוא'],
    includeKeywords: ['תפוחי אדמה'],
    excludeKeywords: ['פירה', 'צ\'יפס', 'קפוא', 'תפוחים'],
  },
  {
    name: 'גזר',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['גזר', 'כתום'],
    includeKeywords: ['גזר'],
    excludeKeywords: ['מיץ', 'קפוא', 'משומר'],
  },
  {
    name: 'פלפל',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['פלפל', 'ירוק', 'אדום', 'צהוב'],
    includeKeywords: ['פלפל'],
    excludeKeywords: ['שחור', 'טחון', 'תבלין', 'חריף', 'פפריקה'],
  },
  {
    name: 'חסה',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['חסה', 'חסת', 'סלט', 'ירוק'],
    includeKeywords: ['חסה'],
    excludeKeywords: ['רוטב', 'קיסר'],
  },
  {
    name: 'אבוקדו',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['אבוקדו', 'אבוקאדו'],
    includeKeywords: ['אבוקדו'],
    excludeKeywords: ['גוואקמולי', 'קפוא', 'שמן'],
  },
  {
    name: 'לימון',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['לימון', 'לימונים'],
    includeKeywords: ['לימון'],
    excludeKeywords: ['מיץ', 'משקה', 'ממתק', 'סירופ'],
  },

  // ─── פירות ────────────────────────────────────────────────────────
  {
    name: 'תפוחים',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['תפוח', 'תפוחים', 'ירוק', 'אדום'],
    includeKeywords: ['תפוח', 'תפוחים'],
    excludeKeywords: ['מיץ', 'אדמה', 'רסק', 'חומץ', 'מיובש'],
    variants: [
      {
        name: 'גרני סמית',
        keywords: ['גרני', 'סמית', 'ירוק'],
        includeKeywords: ['גרני', 'סמית'],
        excludeKeywords: ['פינק', 'ליידי'],
      },
      {
        name: 'פינק ליידי',
        keywords: ['פינק', 'ליידי', 'אדום'],
        includeKeywords: ['פינק', 'ליידי'],
        excludeKeywords: ['גרני', 'סמית'],
      },
    ],
  },
  {
    name: 'בננות',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['בננה', 'בננות'],
    includeKeywords: ['בננה', 'בננות'],
    excludeKeywords: ['מיובשת', 'צ\'יפס', 'מיץ'],
  },
  {
    name: 'תפוזים',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['תפוז', 'תפוזים'],
    includeKeywords: ['תפוז'],
    excludeKeywords: ['מיץ', 'סירופ', 'ממתק'],
  },
  {
    name: 'קלמנטינות',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['קלמנטינה', 'קלמנטינות', 'מנדרינה'],
    includeKeywords: ['קלמנטינ'],
    excludeKeywords: ['מיץ'],
  },
  {
    name: 'ענבים',
    department: 'מזון',
    category: 'פירות וירקות',
    selectionMode: 'canonical',
    keywords: ['ענבים', 'ענב'],
    includeKeywords: ['ענבים'],
    excludeKeywords: ['יין', 'מיץ', 'צימוקים'],
  },

  // ─── דגנים, פסטה וקטניות ──────────────────────────────────────────
  {
    name: 'אורז',
    department: 'מזון',
    category: 'פסטה, אורז וקטניות',
    selectionMode: 'canonical',
    keywords: ['אורז', 'לבן', 'בסמטי'],
    includeKeywords: ['אורז'],
    excludeKeywords: ['עוגיות', 'חטיף', 'פריכיות'],
    variants: [
      {
        name: 'לבן',
        keywords: ['לבן', 'רגיל'],
        includeKeywords: ['לבן'],
        excludeKeywords: ['בסמטי', 'מלא', 'חום', 'סושי'],
      },
      {
        name: 'בסמטי',
        keywords: ['בסמטי'],
        includeKeywords: ['בסמטי'],
        excludeKeywords: ['לבן', 'מלא'],
      },
      {
        name: 'מלא',
        keywords: ['מלא', 'חום'],
        includeKeywords: ['מלא'],
        excludeKeywords: ['לבן', 'בסמטי'],
      },
    ],
  },
  {
    name: 'פסטה',
    department: 'מזון',
    category: 'פסטה, אורז וקטניות',
    selectionMode: 'canonical',
    keywords: ['פסטה', 'ספגטי', 'פנה', 'מקרוני'],
    includeKeywords: ['פסטה'],
    excludeKeywords: ['רוטב', 'מוכנה'],
    variants: [
      {
        name: 'ספגטי',
        keywords: ['ספגטי'],
        includeKeywords: ['ספגטי'],
        excludeKeywords: ['פנה', 'מקרוני'],
      },
      {
        name: 'פנה',
        keywords: ['פנה'],
        includeKeywords: ['פנה'],
        excludeKeywords: ['ספגטי', 'מקרוני'],
      },
      {
        name: 'מקרוני',
        keywords: ['מקרוני'],
        includeKeywords: ['מקרוני'],
        excludeKeywords: ['ספגטי', 'פנה'],
      },
    ],
  },
  {
    name: 'קוסקוס',
    department: 'מזון',
    category: 'פסטה, אורז וקטניות',
    selectionMode: 'canonical',
    keywords: ['קוסקוס', 'פתיתים'],
    includeKeywords: ['קוסקוס'],
    excludeKeywords: ['מוכן', 'סלט'],
  },
  {
    name: 'עדשים',
    department: 'מזון',
    category: 'פסטה, אורז וקטניות',
    selectionMode: 'canonical',
    keywords: ['עדשים', 'אדומות', 'ירוקות'],
    includeKeywords: ['עדשים'],
    excludeKeywords: ['מרק', 'שימורים'],
  },
  {
    name: 'חומוס (גרגירים)',
    department: 'מזון',
    category: 'פסטה, אורז וקטניות',
    selectionMode: 'canonical',
    keywords: ['חומוס', 'גרגירי', 'שימורים'],
    includeKeywords: ['חומוס'],
    excludeKeywords: ['ממרח', 'מוכן', 'סלט'],
  },

  // ─── שימורים, ממרחים ורטבים ────────────────────────────────────────
  {
    name: 'טונה בשמן',
    department: 'מזון',
    category: 'שימורים, ממרחים ורטבים',
    selectionMode: 'canonical',
    keywords: ['טונה', 'שמן', 'שימורים', 'פחית'],
    includeKeywords: ['טונה'],
    excludeKeywords: ['במים', 'סטייק', 'סשימי'],
  },
  {
    name: 'תירס מתוק',
    department: 'מזון',
    category: 'שימורים, ממרחים ורטבים',
    selectionMode: 'canonical',
    keywords: ['תירס', 'מתוק', 'שימורים', 'פחית'],
    includeKeywords: ['תירס'],
    excludeKeywords: ['קפוא', 'פופקורן', 'טורטיה'],
  },
  {
    name: 'רסק עגבניות',
    department: 'מזון',
    category: 'שימורים, ממרחים ורטבים',
    selectionMode: 'canonical',
    keywords: ['רסק', 'עגבניות', 'עגבניה', 'משחה'],
    includeKeywords: ['רסק', 'עגבני'],
    excludeKeywords: ['קטשופ', 'רוטב'],
  },
  {
    name: 'חומוס (ממרח)',
    department: 'מזון',
    category: 'שימורים, ממרחים ורטבים',
    selectionMode: 'sku',
    keywords: ['חומוס', 'ממרח', 'מוכן'],
    includeKeywords: ['חומוס'],
    excludeKeywords: ['גרגירי', 'קטניות', 'יבש'],
  },
  {
    name: 'טחינה',
    department: 'מזון',
    category: 'שימורים, ממרחים ורטבים',
    selectionMode: 'canonical',
    keywords: ['טחינה', 'טחינה גולמית', 'שומשום'],
    includeKeywords: ['טחינה'],
    excludeKeywords: ['חלווה', 'ממתק'],
  },
  {
    name: 'קטשופ',
    department: 'מזון',
    category: 'שימורים, ממרחים ורטבים',
    selectionMode: 'sku',
    keywords: ['קטשופ', 'עגבניות', 'רוטב'],
    includeKeywords: ['קטשופ'],
    excludeKeywords: ['רסק', 'מיונז'],
  },
  {
    name: 'מיונז',
    department: 'מזון',
    category: 'שימורים, ממרחים ורטבים',
    selectionMode: 'sku',
    keywords: ['מיונז', 'מיונז'],
    includeKeywords: ['מיונז'],
    excludeKeywords: ['קטשופ', 'חרדל'],
  },
  {
    name: 'רוטב סויה',
    department: 'מזון',
    category: 'שימורים, ממרחים ורטבים',
    selectionMode: 'sku',
    keywords: ['רוטב', 'סויה'],
    includeKeywords: ['סויה', 'רוטב'],
    excludeKeywords: ['שמן', 'חלב', 'אדממה'],
  },

  // ─── שמנים, תבלינים ומוצרי אפייה ─────────────────────────────────
  {
    name: 'שמן זית',
    department: 'מזון',
    category: 'שמנים, תבלינים ואפייה',
    selectionMode: 'canonical',
    keywords: ['שמן', 'זית', 'כתית', 'מעולה'],
    includeKeywords: ['שמן', 'זית'],
    excludeKeywords: ['קנולה', 'חמניות', 'סויה', 'ספריי'],
  },
  {
    name: 'שמן קנולה',
    department: 'מזון',
    category: 'שמנים, תבלינים ואפייה',
    selectionMode: 'canonical',
    keywords: ['שמן', 'קנולה'],
    includeKeywords: ['שמן', 'קנולה'],
    excludeKeywords: ['זית', 'חמניות'],
  },
  {
    name: 'מלח',
    department: 'מזון',
    category: 'שמנים, תבלינים ואפייה',
    selectionMode: 'canonical',
    keywords: ['מלח', 'שולחן'],
    includeKeywords: ['מלח'],
    excludeKeywords: ['מלפפון', 'ממרח', 'מלוח'],
  },
  {
    name: 'סוכר',
    department: 'מזון',
    category: 'שמנים, תבלינים ואפייה',
    selectionMode: 'canonical',
    keywords: ['סוכר', 'לבן', 'דק'],
    includeKeywords: ['סוכר'],
    excludeKeywords: ['סוכריה', 'ממתק', 'דיאט', 'סטיוויה', 'חום'],
  },
  {
    name: 'קמח לבן',
    department: 'מזון',
    category: 'שמנים, תבלינים ואפייה',
    selectionMode: 'canonical',
    keywords: ['קמח', 'לבן', 'רגיל', 'תכליתי'],
    includeKeywords: ['קמח'],
    excludeKeywords: ['מלא', 'כוסמין', 'שיבולת', 'תירס'],
  },
  {
    name: 'אבקת אפייה',
    department: 'מזון',
    category: 'שמנים, תבלינים ואפייה',
    selectionMode: 'canonical',
    keywords: ['אבקת', 'אפייה'],
    includeKeywords: ['אבקת', 'אפייה'],
    excludeKeywords: ['חלבון', 'שתייה'],
  },

  // ─── חטיפים, מתוקים ושוקולד ───────────────────────────────────────
  {
    name: 'שוקולד',
    department: 'מזון',
    category: 'חטיפים, מתוקים ושוקולד',
    selectionMode: 'sku',
    keywords: ['שוקולד', 'מריר', 'לבן', 'חפיסה', 'טבלה'],
    includeKeywords: ['שוקולד'],
    excludeKeywords: ['אבקה', 'שתייה', 'גלידה'],
  },
  {
    name: 'במבה',
    department: 'מזון',
    category: 'חטיפים, מתוקים ושוקולד',
    selectionMode: 'sku',
    keywords: ['במבה', 'אוסם', 'בוטנים', 'חטיף'],
    includeKeywords: ['במבה'],
    excludeKeywords: [],
  },
  {
    name: 'ביסלי',
    department: 'מזון',
    category: 'חטיפים, מתוקים ושוקולד',
    selectionMode: 'sku',
    keywords: ['ביסלי', 'אוסם', 'גריל', 'פיצה', 'חטיף'],
    includeKeywords: ['ביסלי'],
    excludeKeywords: [],
  },
  {
    name: 'חטיף אנרגיה',
    department: 'מזון',
    category: 'חטיפים, מתוקים ושוקולד',
    selectionMode: 'sku',
    keywords: ['חטיף', 'אנרגיה', 'גרנולה', 'בר'],
    includeKeywords: ['חטיף'],
    excludeKeywords: ['במבה', 'ביסלי', 'צ\'יפס'],
  },
  {
    name: 'צ\'יפס',
    department: 'מזון',
    category: 'חטיפים, מתוקים ושוקולד',
    selectionMode: 'sku',
    keywords: ['צ\'יפס', 'תפוצ\'יפס', 'פרינגלס', 'מלוח'],
    includeKeywords: ['צ\'יפס', 'תפוצ\'יפס'],
    excludeKeywords: ['במבה', 'ביסלי'],
  },
  {
    name: 'עוגיות',
    department: 'מזון',
    category: 'חטיפים, מתוקים ושוקולד',
    selectionMode: 'sku',
    keywords: ['עוגיות', 'עוגיה', 'ביסקוויט'],
    includeKeywords: ['עוגיות', 'עוגיה'],
    excludeKeywords: ['קמח', 'אבקה', 'תבנית'],
  },
  {
    name: 'וופלים',
    department: 'מזון',
    category: 'חטיפים, מתוקים ושוקולד',
    selectionMode: 'sku',
    keywords: ['וופל', 'וופלים'],
    includeKeywords: ['וופל'],
    excludeKeywords: ['מכונה', 'תבנית'],
  },
  {
    name: 'פופקורן',
    department: 'מזון',
    category: 'חטיפים, מתוקים ושוקולד',
    selectionMode: 'sku',
    keywords: ['פופקורן', 'תירס', 'מלוח', 'חמאה'],
    includeKeywords: ['פופקורן'],
    excludeKeywords: ['תירס מתוק'],
  },

  // ─── לחם, מאפים ודגני בוקר ────────────────────────────────────────
  {
    name: 'קורנפלקס',
    department: 'מזון',
    category: 'דגני בוקר',
    selectionMode: 'sku',
    keywords: ['קורנפלקס', 'דגני', 'בוקר', 'כוכביות'],
    includeKeywords: ['קורנפלקס', 'דגני בוקר'],
    excludeKeywords: [],
  },
  {
    name: 'גרנולה',
    department: 'מזון',
    category: 'דגני בוקר',
    selectionMode: 'sku',
    keywords: ['גרנולה', 'שיבולת', 'שועל'],
    includeKeywords: ['גרנולה'],
    excludeKeywords: ['חטיף'],
  },
  {
    name: 'שיבולת שועל',
    department: 'מזון',
    category: 'דגני בוקר',
    selectionMode: 'canonical',
    keywords: ['שיבולת', 'שועל', 'אוטמיל', 'דייסה'],
    includeKeywords: ['שיבולת', 'שועל'],
    excludeKeywords: ['גרנולה', 'חטיף', 'עוגיות'],
  },

  // ─── משקאות ────────────────────────────────────────────────────────
  {
    name: 'מים מינרליים',
    department: 'משקאות',
    category: 'משקאות',
    selectionMode: 'canonical',
    keywords: ['מים', 'מינרליים', 'בקבוק'],
    includeKeywords: ['מים', 'מינרליים'],
    excludeKeywords: ['סודה', 'בטעם', 'מוגז'],
    variants: [
      {
        name: '1.5 ליטר',
        keywords: ['1.5', 'ליטר'],
        includeKeywords: ['1.5'],
        excludeKeywords: ['6', 'שישיה'],
      },
      {
        name: '6 חבילה',
        keywords: ['6', 'חבילה', 'שישיה'],
        includeKeywords: ['6'],
        excludeKeywords: [],
      },
    ],
  },
  {
    name: 'קולה',
    department: 'משקאות',
    category: 'משקאות',
    selectionMode: 'sku',
    keywords: ['קולה', 'קוקה', 'פפסי', 'דיאט', 'זירו'],
    includeKeywords: ['קולה'],
    excludeKeywords: [],
  },
  {
    name: 'מיץ תפוזים',
    department: 'משקאות',
    category: 'משקאות',
    selectionMode: 'sku',
    keywords: ['מיץ', 'תפוזים', 'סחוט', 'טבעי'],
    includeKeywords: ['מיץ', 'תפוז'],
    excludeKeywords: ['ענבים', 'תפוחים', 'גזר'],
  },
  {
    name: 'סודה / מים מוגזים',
    department: 'משקאות',
    category: 'משקאות',
    selectionMode: 'canonical',
    keywords: ['סודה', 'מוגז', 'מים מוגזים'],
    includeKeywords: ['סודה', 'מוגז'],
    excludeKeywords: ['קולה', 'בטעם'],
  },

  // ─── קפואים ───────────────────────────────────────────────────────
  {
    name: 'שעועית ירוקה קפואה',
    department: 'מזון',
    category: 'קפואים',
    selectionMode: 'canonical',
    keywords: ['שעועית', 'ירוקה', 'קפואה', 'קפוא'],
    includeKeywords: ['שעועית', 'קפוא'],
    excludeKeywords: ['שימורים', 'יבשה'],
  },
  {
    name: 'אפונה קפואה',
    department: 'מזון',
    category: 'קפואים',
    selectionMode: 'canonical',
    keywords: ['אפונה', 'קפואה', 'קפוא'],
    includeKeywords: ['אפונה', 'קפוא'],
    excludeKeywords: ['שימורים', 'יבשה'],
  },
  {
    name: 'צ\'יפס קפוא',
    department: 'מזון',
    category: 'קפואים',
    selectionMode: 'sku',
    keywords: ['צ\'יפס', 'קפוא', 'תפוחי אדמה'],
    includeKeywords: ['צ\'יפס', 'קפוא'],
    excludeKeywords: ['חטיף'],
  },

  // ─── קפה ותה ──────────────────────────────────────────────────────
  {
    name: 'קפה טורקי',
    department: 'מזון',
    category: 'קפה ותה',
    selectionMode: 'sku',
    keywords: ['קפה', 'טורקי', 'עלית', 'נמס'],
    includeKeywords: ['קפה', 'טורקי'],
    excludeKeywords: ['נמס', 'קפסולות', 'אספרסו'],
  },
  {
    name: 'קפה נמס',
    department: 'מזון',
    category: 'קפה ותה',
    selectionMode: 'sku',
    keywords: ['קפה', 'נמס', 'טסטרס', 'נסקפה'],
    includeKeywords: ['קפה', 'נמס'],
    excludeKeywords: ['טורקי', 'קפסולות'],
  },
  {
    name: 'תה',
    department: 'מזון',
    category: 'קפה ותה',
    selectionMode: 'sku',
    keywords: ['תה', 'שקיקים', 'נענע', 'ירוק', 'שחור'],
    includeKeywords: ['תה'],
    excludeKeywords: ['קפה'],
  },

  // ─── ניקיון ובית ──────────────────────────────────────────────────
  {
    name: 'נייר טואלט',
    department: 'ניקיון ובית',
    category: 'ניקיון ובית',
    selectionMode: 'sku',
    keywords: ['נייר', 'טואלט', 'גלילים'],
    includeKeywords: ['נייר', 'טואלט'],
    excludeKeywords: ['מגבת', 'סופג'],
  },
  {
    name: 'סבון כלים',
    department: 'ניקיון ובית',
    category: 'ניקיון ובית',
    selectionMode: 'sku',
    keywords: ['סבון', 'כלים', 'נוזלי'],
    includeKeywords: ['סבון', 'כלים'],
    excludeKeywords: ['גוף', 'ידיים', 'כביסה'],
  },
  {
    name: 'אקונומיקה',
    department: 'ניקיון ובית',
    category: 'ניקיון ובית',
    selectionMode: 'canonical',
    keywords: ['אקונומיקה', 'לבן', 'חומר חיטוי'],
    includeKeywords: ['אקונומיקה'],
    excludeKeywords: [],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await connectMongo();

  const groupRepo = new ProductGroupRepository();
  const variantRepo = new ProductVariantRepository();

  let groupCount = 0;
  let variantCount = 0;

  for (const seed of SEED_GROUPS) {
    const normalizedName = normalizeName(seed.name);
    const normalizedKeywords = seed.keywords.map(normalizeName).filter(Boolean);

    const group = await groupRepo.upsertByName({
      name: seed.name,
      normalizedName,
      department: seed.department,
      category: seed.category,
      selectionMode: seed.selectionMode,
      keywords: seed.keywords,
      normalizedKeywords,
      includeKeywords: seed.includeKeywords,
      excludeKeywords: seed.excludeKeywords,
    });
    groupCount++;

    if (seed.variants) {
      for (const v of seed.variants) {
        const normalizedVarKeywords = v.keywords.map(normalizeName).filter(Boolean);

        await variantRepo.upsertByGroupAndName({
          groupId: group.id,
          name: v.name,
          keywords: v.keywords,
          normalizedKeywords: normalizedVarKeywords,
          includeKeywords: v.includeKeywords ?? [],
          excludeKeywords: v.excludeKeywords ?? [],
        });
        variantCount++;
      }
    }
  }

  // Clean up stale groups that no longer exist in the seed
  const seededNames = new Set(SEED_GROUPS.map((s) => normalizeName(s.name)));
  const ProductGroupModel = mongoose.connection.collection('productgroups');
  const allDocs = await ProductGroupModel.find({}, { projection: { normalizedName: 1 } }).toArray();
  const staleIds = allDocs
    .filter((d) => !seededNames.has(d.normalizedName))
    .map((d) => d._id);
  if (staleIds.length > 0) {
    await ProductGroupModel.deleteMany({ _id: { $in: staleIds } });
    console.log(`Removed ${staleIds.length} stale product groups.`);
  }

  console.log(`Seeded ${groupCount} product groups and ${variantCount} variants.`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
