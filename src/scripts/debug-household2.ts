import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

async function q(label: string, regex: string, limit = 60) {
  const docs = await ChainProductMongoose.find({
    isActive: true,
    normalizedName: { $regex: regex, $options: 'i' },
  }).limit(limit).lean();
  const names = [...new Set(docs.map((d: any) => d.originalName as string))];
  console.log(`\n=== ${label} (${names.length}) ===`);
  names.forEach(n => console.log(' ', n));
}

async function main() {
  await connectMongo();

  console.log('\n>>> אבקת כביסה <<<');
  await q('אבקת כביסה exact', 'אבקת כביסה');
  await q('א.כביסה abbrev', 'א\\.?כביסה');
  await q('gel/liquid כביסה', '(?=.*כביסה)(?=.*גל|ג\'ל|נוזל|liquid)');
  await q('capsules כביסה', '(?=.*כביסה)(?=.*קפסול|פוד|pod)');

  console.log('\n>>> סבון ידיים <<<');
  await q('סבון ידיים', 'סבון.*ידיים|ידיים.*סבון');
  await q('סבון נוזלי', 'סבון.*נוזלי|נוזלי.*סבון');
  await q('all סבון (sample)', 'סבון', 80);

  console.log('\n>>> מגבונים <<<');
  await q('all מגבונים', 'מגבונ', 80);

  await mongoose.disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
