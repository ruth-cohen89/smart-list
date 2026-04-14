import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import { ProductGroupService } from '../services/product-group.service';

async function main() {
  await connectMongo();

  const service = new ProductGroupService();

  const queries = [
    'חלב שיבולת שועל',
    'חלב שקדים',
    'חלב סויה',
    'גבינה בולגרית',
    'גבינת עיזים',
    'פרמזן',
    'ריקוטה',
    'עוף שלם',
    'כנפיים עוף',
    'דג',
    'סלמון טרי',
    'דניס',
    'ברמונדי',
    'באגט',
    'לחם שיפון',
    'אטריות',
    'קמח מלא',
  ];

  for (const q of queries) {
    console.log(`\n${'─'.repeat(60)}`);
    const groups = await service.search(q, 1);
    if (groups.length === 0) {
      console.log(`"${q}" → NO GROUP FOUND`);
      continue;
    }
    const group = groups[0];
    console.log(`"${q}" → group: ${group.name} (${group.category})`);

    const result = await service.mapToProducts(group.id);
    const chains = Object.entries(result.results);
    if (chains.length === 0) {
      console.log('  ⚠ No chain results');
      continue;
    }
    for (const [chainId, matches] of chains) {
      const top = matches[0];
      if (top) {
        console.log(`  ${chainId}: "${top.name}" score=${top.score.toFixed(2)} ₪${top.price}`);
      }
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
