import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

async function main() {
  await connectMongo();

  for (const chain of ['shufersal', 'rami-levy', 'machsanei-hashuk']) {
    const results = await ChainProductMongoose.find({
      isActive: true,
      chainId: chain,
      originalName: { $regex: 'בולגרי', $options: 'i' },
    }).limit(5).lean();

    console.log(`${chain}: ${results.length} results`);
    for (const r of results) {
      console.log(`  "${r.originalName}" ₪${r.price}`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
