/**
 * Inspect shufersal chain products containing מלפפון.
 * Usage: npx ts-node src/scripts/debug-cucumber-shufersal.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';
import ProductMongoose from '../infrastructure/db/product.mongoose.model';

async function main() {
  await connectMongo();

  const products = await ChainProductMongoose.find({
    chainId: 'shufersal',
    normalizedName: { $regex: 'מלפפון' },
    isActive: true,
  }).lean();

  console.log(`\nShufersal active products containing "מלפפון": ${products.length}\n`);

  for (const p of products) {
    let globalInfo = 'none';
    if (p.productId) {
      const gp = await ProductMongoose.findById(p.productId).lean();
      globalInfo = gp
        ? `id=${gp._id} type=${gp.productType} key=${gp.canonicalKey ?? '–'} name="${gp.canonicalName}"`
        : 'NOT FOUND';
    }
    console.log(`  chainType=${p.productType ?? 'none'}  "${p.originalName}"`);
    console.log(`    productId=${p.productId ?? 'none'}`);
    console.log(`    → global: ${globalInfo}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
