import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

async function main() {
  await connectMongo();

  // Find products where normalizedName starts with לימון
  const results = await ChainProductMongoose.find({
    isActive: true,
    normalizedName: { $regex: '^לימון', $options: 'i' },
  }).limit(30).lean();

  console.log('Products starting with לימון:');
  for (const r of results) {
    console.log(`  [${r.chainId}] "${r.originalName}" price=${r.price}`);
  }
  console.log(`Total: ${results.length}`);

  // Also find "לימון" as standalone word (fresh lemons)
  const fresh = await ChainProductMongoose.find({
    isActive: true,
    originalName: { $regex: '^לימון[ים]*\\s*$|^לימון\\s+(צהוב|ירוק)', $options: 'i' },
  }).limit(10).lean();

  console.log('\nFresh lemons (standalone):');
  for (const r of fresh) {
    console.log(`  [${r.chainId}] "${r.originalName}" price=${r.price}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
