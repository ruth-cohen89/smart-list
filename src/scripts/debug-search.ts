import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import { ProductGroupService } from '../services/product-group.service';

async function main() {
  await connectMongo();

  const service = new ProductGroupService();

  const queries = [
    // New groups — exact matches (fast path)
    'משקה שיבולת שועל',
    'משקה שקדים',
    'משקה סויה',
    'גבינה בולגרית',
    'גבינת עיזים',
    'פרמזן',
    'ריקוטה',
    'עוף שלם',
    'כנפיים עוף',
    'סלמון טרי',
    'דניס',
    'ברמונדי',
    'באגט',
    'לחם שיפון',
    'אטריות',
    'קמח מלא',
    'דג',
    // Multi-word fallback queries
    'חלב שיבולת שועל',
    'חלב שקדים',
    'קמח חיטה מלא',
    // Regression: existing queries
    'חלב',
    'גבינה צהובה',
    'שיבולת שועל',
    'שמן זית',
    'חזה עוף',
  ];

  for (const q of queries) {
    const results = await service.search(q, 3);
    if (results.length === 0) {
      console.log(`"${q}" → 0 results`);
    } else {
      console.log(`"${q}" → #1: ${results[0].name} (${results[0].category})`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
