import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
import mongoose from 'mongoose';
import ChainProductMongoose from '../src/infrastructure/db/chain-product.mongoose.model';

async function run() {
  await mongoose.connect(process.env.MONGO_URI!);

  const docs1 = await ChainProductMongoose.find({
    chainId: 'shufersal',
    isActive: true,
    normalizedName: { $regex: '(?=.*בצל)(?=.*אדום)', $options: 'i' },
  }).lean();
  console.log('=== בצל+אדום (AND) ===');
  docs1.forEach((d) => console.log(`  "${d.originalName}" | norm="${d.normalizedName}"`));

  const docs2 = await ChainProductMongoose.find({
    chainId: 'shufersal',
    isActive: true,
    normalizedName: { $regex: 'בטטה', $options: 'i' },
  }).lean();
  console.log('\n=== בטטה ===');
  docs2.forEach((d) => console.log(`  "${d.originalName}" | norm="${d.normalizedName}"`));

  await mongoose.disconnect();
}
run().catch(console.error);
