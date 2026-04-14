import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

async function main() {
  await connectMongo();

  // Search for Bulgarian cheese variants in chain products
  const terms = ['בולגרי', 'מלוחה', 'צפתית', 'צפת'];
  for (const term of terms) {
    const results = await ChainProductMongoose.find({
      isActive: true,
      $or: [
        { normalizedName: { $regex: term, $options: 'i' } },
        { originalName: { $regex: term, $options: 'i' } },
      ],
    }).limit(5).lean();

    console.log(`\n"${term}" → ${results.length} products:`);
    for (const r of results) {
      console.log(`  [${r.chainId}] "${r.originalName}" ₪${r.price}`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
