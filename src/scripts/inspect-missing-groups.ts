/**
 * Inspect real chainProducts for missing/poorly-modeled product groups.
 * Usage: npx ts-node src/scripts/inspect-missing-groups.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

const SEARCHES = [
  { label: 'שוקולד חלב', regex: 'שוקולד.*חלב|חלב.*שוקולד' },
  { label: 'שוקולד מריר', regex: 'שוקולד.*מריר|מריר.*שוקולד' },
  { label: 'שוקולד לבן', regex: 'שוקולד.*לבן|לבן.*שוקולד' },
  { label: 'שוקולד (all)', regex: 'שוקולד' },
  { label: 'עוגיות (all)', regex: 'עוגיות' },
  { label: 'גלידה (all)', regex: 'גלידה' },
  { label: 'גביע גלידה', regex: 'גביע' },
  { label: 'עוגה (all)', regex: 'עוגה|עוגת' },
  { label: 'אבקת אפייה', regex: 'אבקת אפיי' },
];

async function main() {
  await connectMongo();

  for (const { label, regex } of SEARCHES) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`SEARCH: ${label}  regex: /${regex}/`);
    console.log('═'.repeat(70));

    const docs = await ChainProductMongoose.find({
      isActive: true,
      originalName: { $regex: regex, $options: 'i' },
    })
      .limit(30)
      .lean();

    console.log(`  Found ${docs.length} products (limit 30)\n`);

    const byChain: Record<string, typeof docs> = {};
    for (const d of docs) {
      const chain = d.chainId as string;
      if (!byChain[chain]) byChain[chain] = [];
      byChain[chain].push(d);
    }

    for (const [chain, items] of Object.entries(byChain)) {
      console.log(`  [${chain}]`);
      for (const d of items.slice(0, 8)) {
        console.log(`    "${d.originalName}"  price=${d.price}  barcode=${d.barcode ?? '-'}`);
      }
      if (items.length > 8) console.log(`    ... and ${items.length - 8} more`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
