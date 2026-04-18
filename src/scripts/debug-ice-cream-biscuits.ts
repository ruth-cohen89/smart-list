/**
 * Debug ice cream, biscuits, and packaged cake groups.
 * Usage: npx ts-node src/scripts/debug-ice-cream-biscuits.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

const SEARCHES = [
  { label: 'גלידה פיינטים/פינטים (500מל)', regex: 'גלידה.*(פיינטים|פינטים|500)' },
  { label: 'גלידה משפחתית', regex: 'גלידה.*משפחתית|משפחתית.*גלידה' },
  { label: 'גביעי גלידה (wafer cones)', regex: 'גביע.*גלידה|גלידה.*גביע' },
  { label: 'גלידה ALL (no filter)', regex: 'גלידה', limit: 50 },
  { label: 'ביסקוויט', regex: 'ביסקוויט', limit: 40 },
  { label: 'עוגיות (all)', regex: 'עוגיות', limit: 40 },
  { label: 'עוגה ארוזה / עוגת (packaged)', regex: 'עוגה|עוגת', limit: 50 },
];

async function main() {
  await connectMongo();

  for (const { label, regex, limit = 30 } of SEARCHES) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`SEARCH: ${label}  regex: /${regex}/`);
    console.log('═'.repeat(70));

    const docs = await ChainProductMongoose.find({
      isActive: true,
      originalName: { $regex: regex, $options: 'i' },
    })
      .limit(limit)
      .lean();

    console.log(`  Found ${docs.length} products (limit ${limit})\n`);

    const byChain: Record<string, typeof docs> = {};
    for (const d of docs) {
      const chain = d.chainId as string;
      if (!byChain[chain]) byChain[chain] = [];
      byChain[chain].push(d);
    }

    for (const [chain, items] of Object.entries(byChain)) {
      console.log(`  [${chain}] (${items.length})`);
      for (const d of items) {
        console.log(`    "${d.originalName}"  price=${d.price}  barcode=${d.barcode ?? '-'}`);
      }
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
