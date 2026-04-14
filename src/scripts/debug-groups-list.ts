import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ProductGroupMongoose from '../infrastructure/db/product-group.mongoose.model';

async function main() {
  await connectMongo();
  const all = await ProductGroupMongoose.find().select('name normalizedName normalizedKeywords aliases').sort({ name: 1 }).lean();
  for (const g of all) {
    const kw = (g.normalizedKeywords || []).join(',');
    const al = (g.aliases || []).join(',');
    console.log(`${g.name} | kw:[${kw}] | al:[${al}]`);
  }
  console.log(`Total: ${all.length}`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
