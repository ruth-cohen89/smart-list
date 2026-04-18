/**
 * Verify new/updated product groups return expected results.
 * Usage: npx ts-node src/scripts/verify-new-groups.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import { ProductGroupService } from '../services/product-group.service';
import { normalizeName } from '../utils/normalize';
import ProductGroupMongoose from '../infrastructure/db/product-group.mongoose.model';

const VERIFY_GROUPS = [
  'סודה / מים מוגזים',
  'אבקת אפייה',
  'טישו / ממחטות',
];

async function main() {
  await connectMongo();
  const service = new ProductGroupService();

  for (const groupName of VERIFY_GROUPS) {
    const group = await ProductGroupMongoose.findOne({ normalizedName: normalizeName(groupName) }).lean();
    if (!group) {
      console.log(`\n❌ GROUP NOT FOUND: ${groupName}`);
      continue;
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`GROUP: ${groupName}`);
    console.log(`  include=[${group.includeKeywords?.join(', ')}]  exclude=[${group.excludeKeywords?.slice(0,5).join(', ')}...]`);
    console.log(`  aliases=[${group.aliases?.join(', ')}]`);

    const result = await service.mapToProducts(group._id.toString());
    let total = 0;
    for (const [chain, matches] of Object.entries(result.results)) {
      total += matches.length;
      console.log(`  [${chain}] ${matches.length} match(es):`);
      for (const m of matches) {
        console.log(`    ✅ "${m.name}"  price=${m.price}  score=${m.score.toFixed(2)}`);
      }
    }
    if (total === 0) {
      console.log(`  ⚠️  NO MATCHES FOUND`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
