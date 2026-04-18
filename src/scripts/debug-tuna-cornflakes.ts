/**
 * Query real chainProducts for tuna & cornflakes to identify patterns.
 * Usage: npx ts-node src/scripts/debug-tuna-cornflakes.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

async function queryPattern(label: string, regex: string) {
  const docs = await ChainProductMongoose.find({
    isActive: true,
    normalizedName: { $regex: regex, $options: 'i' },
  }).limit(100).lean();

  console.log(`\n── ${label} (regex: ${regex}) → ${docs.length} results ──`);
  const seen = new Set<string>();
  for (const d of docs) {
    const key = d.originalName as string;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`  chain=${d.chainId} "${d.originalName}"`);
    }
  }
}

async function main() {
  await connectMongo();

  // ── Tuna ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('TUNA PRODUCTS');
  console.log('═'.repeat(70));

  await queryPattern('All tuna', 'טונה');
  await queryPattern('Tuna in oil (שמן)', '(?=.*טונה)(?=.*שמן)');
  await queryPattern('Tuna in water (מים)', '(?=.*טונה)(?=.*מים)');
  await queryPattern('Tuna in olive oil (זית)', '(?=.*טונה)(?=.*זית)');
  await queryPattern('Tuna in canola (קנולה)', '(?=.*טונה)(?=.*קנולה)');
  await queryPattern('Tuna steak (סטייק)', '(?=.*טונה)(?=.*סטייק)');

  // ── Cornflakes ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('CORNFLAKES PRODUCTS');
  console.log('═'.repeat(70));

  await queryPattern('All קורנפלקס', 'קורנפלקס');
  await queryPattern('All דגני בוקר', 'דגני.בוקר');
  await queryPattern('Kelloggs', 'קלוגס');
  await queryPattern('Telma תלמה', 'תלמה');
  await queryPattern('Nestle / Nesquik', '(?:נסטלה|נסקוויק|nestle|nesquik)');
  await queryPattern('כוכביות', 'כוכביות');
  await queryPattern('Honey Stars / chocolate puffs / frosties / granola brands', '(?:פרוסטיז|פרוסטי|חמי|אסאי|שוקו|ספיישל|ספשיאל|קורנפלוקס|סוכר|דבש|שוקולד).{0,20}דגני');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
