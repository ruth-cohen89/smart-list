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
  category: string;
  keywords: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  variants?: VariantSeed[];
}

const SEED_GROUPS: GroupSeed[] = [
  // ─── חלב ומוצרי חלב ──────────────────────────────────────────────
  {
    name: 'חלב 3%',
    category: 'חלב ומוצרי חלב',
    keywords: ['חלב', '3%', 'שומן', 'טרי'],
    includeKeywords: ['חלב', '3%'],
    excludeKeywords: ['1%', 'ללא לקטוז', 'סויה', 'שקדים', 'קוקוס', 'שוקו'],
  },
  {
    name: 'חלב 1%',
    category: 'חלב ומוצרי חלב',
    keywords: ['חלב', '1%', 'דל שומן', 'טרי'],
    includeKeywords: ['חלב', '1%'],
    excludeKeywords: ['3%', 'ללא לקטוז', 'סויה', 'שקדים', 'קוקוס', 'שוקו'],
  },
  {
    name: "קוטג' 5%",
    category: 'חלב ומוצרי חלב',
    keywords: ['קוטג', '5%', 'גבינה', 'לבנה'],
    includeKeywords: ['קוטג', '5%'],
    excludeKeywords: ['3%', '9%', 'ללא לקטוז'],
  },
  {
    name: 'שמנת מתוקה',
    category: 'חלב ומוצרי חלב',
    keywords: ['שמנת', 'מתוקה', 'להקצפה'],
    includeKeywords: ['שמנת', 'מתוקה'],
    excludeKeywords: ['חמוצה', 'בישול'],
  },
  {
    name: 'יוגורט טבעי',
    category: 'חלב ומוצרי חלב',
    keywords: ['יוגורט', 'טבעי', 'לבן'],
    includeKeywords: ['יוגורט'],
    excludeKeywords: ['פירות', 'שתייה', 'דנונה', 'מילקי'],
  },
  {
    name: 'חמאה',
    category: 'חלב ומוצרי חלב',
    keywords: ['חמאה', 'תבנית'],
    includeKeywords: ['חמאה'],
    excludeKeywords: ['מרגרינה', 'ממרח'],
  },
  {
    name: 'גבינה צהובה 28%',
    category: 'חלב ומוצרי חלב',
    keywords: ['גבינה', 'צהובה', '28%', 'עמק', 'פרוסות'],
    includeKeywords: ['גבינה', 'צהובה'],
    excludeKeywords: ['לבנה', 'קוטג', 'שמנת', 'מוצרלה'],
  },

  // ─── ביצים ────────────────────────────────────────────────────────
  {
    name: 'ביצים L',
    category: 'ביצים',
    keywords: ['ביצים', 'גודל', 'L', 'תבנית'],
    includeKeywords: ['ביצים'],
    excludeKeywords: ['שוקולד', 'הפתעה', 'אבקה'],
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
    category: 'לחם ומאפים',
    keywords: ['לחם', 'אחיד', 'פרוס', 'לבן'],
    includeKeywords: ['לחם', 'אחיד'],
    excludeKeywords: ['מלא', 'קמח מלא', 'שיפון', 'כוסמין'],
  },
  {
    name: 'לחם מלא',
    category: 'לחם ומאפים',
    keywords: ['לחם', 'מלא', 'קמח מלא', 'פרוס'],
    includeKeywords: ['לחם', 'מלא'],
    excludeKeywords: ['אחיד', 'לבן', 'שיפון'],
  },
  {
    name: 'פיתות',
    category: 'לחם ומאפים',
    keywords: ['פיתה', 'פיתות', 'לבנות'],
    includeKeywords: ['פיתה', 'פיתות'],
    excludeKeywords: ['טורטיה', 'לאפה'],
  },

  // ─── בשר ועוף ─────────────────────────────────────────────────────
  {
    name: 'חזה עוף טרי',
    category: 'בשר ועוף',
    keywords: ['חזה', 'עוף', 'טרי', 'פילה'],
    includeKeywords: ['חזה', 'עוף', 'טרי'],
    excludeKeywords: ['קפוא', 'טחון', 'שניצל', 'נקניק', 'כרעיים', 'שוקיים', 'כנפיים'],
    variants: [
      {
        name: 'רגיל',
        keywords: ['רגיל'],
        includeKeywords: [],
        excludeKeywords: ['פרימיום', 'משובח', 'אורגני'],
      },
      {
        name: 'פרימיום',
        keywords: ['פרימיום', 'משובח'],
        includeKeywords: ['פרימיום'],
        excludeKeywords: [],
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
    name: 'חזה עוף קפוא',
    category: 'בשר ועוף',
    keywords: ['חזה', 'עוף', 'קפוא', 'פילה'],
    includeKeywords: ['חזה', 'עוף', 'קפוא'],
    excludeKeywords: ['טרי', 'טחון', 'שניצל', 'נקניק', 'כרעיים'],
  },
  {
    name: 'כרעיים עוף',
    category: 'בשר ועוף',
    keywords: ['כרעיים', 'עוף', 'שוקיים', 'טרי'],
    includeKeywords: ['כרעיים', 'עוף'],
    excludeKeywords: ['חזה', 'כנפיים', 'שניצל', 'קפוא'],
  },
  {
    name: 'בשר טחון',
    category: 'בשר ועוף',
    keywords: ['בשר', 'טחון', 'בקר'],
    includeKeywords: ['בשר', 'טחון'],
    excludeKeywords: ['עוף', 'חזה', 'שניצל', 'נקניק'],
  },

  // ─── ירקות ────────────────────────────────────────────────────────
  {
    name: 'עגבניות',
    category: 'ירקות',
    keywords: ['עגבניה', 'עגבניות', 'אדומות'],
    includeKeywords: ['עגבניה', 'עגבניות'],
    excludeKeywords: ['רסק', 'שימורים', 'קטשופ', 'רוטב', 'מיובשות'],
  },
  {
    name: 'מלפפון',
    category: 'ירקות',
    keywords: ['מלפפון', 'מלפפונים', 'ירוק'],
    includeKeywords: ['מלפפון', 'מלפפונים'],
    excludeKeywords: ['חמוצים', 'כבוש', 'מלפפונון'],
  },
  {
    name: 'בצל יבש',
    category: 'ירקות',
    keywords: ['בצל', 'יבש', 'זהוב'],
    includeKeywords: ['בצל'],
    excludeKeywords: ['ירוק', 'סגול', 'אדום', 'טבעות', 'קפוא'],
  },
  {
    name: 'תפוחי אדמה',
    category: 'ירקות',
    keywords: ['תפוחי', 'אדמה', 'תפוא'],
    includeKeywords: ['תפוחי אדמה'],
    excludeKeywords: ['פירה', 'צ\'יפס', 'קפוא', 'תפוחים'],
  },
  {
    name: 'גזר',
    category: 'ירקות',
    keywords: ['גזר', 'כתום'],
    includeKeywords: ['גזר'],
    excludeKeywords: ['מיץ', 'קפוא', 'משומר'],
  },

  // ─── פירות ────────────────────────────────────────────────────────
  {
    name: 'תפוחים',
    category: 'פירות',
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
    category: 'פירות',
    keywords: ['בננה', 'בננות'],
    includeKeywords: ['בננה', 'בננות'],
    excludeKeywords: ['מיובשת', 'צ\'יפס', 'מיץ'],
  },

  // ─── דגנים ופסטה ──────────────────────────────────────────────────
  {
    name: 'אורז',
    category: 'דגנים ופסטה',
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
    category: 'דגנים ופסטה',
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

  // ─── שימורים ──────────────────────────────────────────────────────
  {
    name: 'טונה בשמן',
    category: 'שימורים',
    keywords: ['טונה', 'שמן', 'שימורים', 'פחית'],
    includeKeywords: ['טונה'],
    excludeKeywords: ['במים', 'סטייק', 'סשימי'],
  },
  {
    name: 'תירס מתוק',
    category: 'שימורים',
    keywords: ['תירס', 'מתוק', 'שימורים', 'פחית'],
    includeKeywords: ['תירס'],
    excludeKeywords: ['קפוא', 'פופקורן', 'טורטיה'],
  },

  // ─── שמנים ותבלינים ───────────────────────────────────────────────
  {
    name: 'שמן זית',
    category: 'שמנים ותבלינים',
    keywords: ['שמן', 'זית', 'כתית', 'מעולה'],
    includeKeywords: ['שמן', 'זית'],
    excludeKeywords: ['קנולה', 'חמניות', 'סויה', 'ספריי'],
  },
  {
    name: 'מלח',
    category: 'שמנים ותבלינים',
    keywords: ['מלח', 'שולחן'],
    includeKeywords: ['מלח'],
    excludeKeywords: ['מלפפון', 'ממרח', 'מלוח'],
  },
  {
    name: 'סוכר',
    category: 'שמנים ותבלינים',
    keywords: ['סוכר', 'לבן', 'דק'],
    includeKeywords: ['סוכר'],
    excludeKeywords: ['סוכריה', 'ממתק', 'דיאט', 'סטיוויה', 'חום'],
  },

  // ─── משקאות ────────────────────────────────────────────────────────
  {
    name: 'מים מינרליים',
    category: 'משקאות',
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
      category: seed.category,
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

  console.log(`Seeded ${groupCount} product groups and ${variantCount} variants.`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
