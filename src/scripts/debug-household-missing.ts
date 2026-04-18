/**
 * Query real chainProducts for אבקת כביסה, סבון ידיים, מגבונים
 * Usage: npx ts-node src/scripts/debug-household-missing.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

import mongoose from 'mongoose';
import { connectMongo } from '../infrastructure/db/mongo';
import ChainProductMongoose from '../infrastructure/db/chain-product.mongoose.model';

async function queryPattern(label: string, regex: string, limit = 80) {
  const docs = await ChainProductMongoose.find({
    isActive: true,
    normalizedName: { $regex: regex, $options: 'i' },
  }).limit(limit).lean();

  console.log(`\n── ${label} (${docs.length} results) ──`);
  const seen = new Set<string>();
  for (const d of docs) {
    const key = `[${d.chainId}] ${d.originalName}`;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`  ${key}`);
    }
  }
}

async function main() {
  await connectMongo();

  // ── אבקת כביסה ────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('אבקת כביסה (LAUNDRY DETERGENT POWDER)');
  console.log('═'.repeat(70));
  await queryPattern('All אבקת כביסה', 'אבקת כביסה');
  await queryPattern('כביסה alone', 'כביסה');
  await queryPattern('אבקה + כביסה (regex)', '(?=.*אבקה)(?=.*כביסה)');
  await queryPattern('ארייל / Ariel', 'ארייל|ariel');
  await queryPattern('פרסיל / Persil', 'פרסיל|persil');
  await queryPattern('סוויף / Swiffer + laundry', '(?=.*כביסה|wash|laundry)');
  await queryPattern('עדין / Fairy-style', 'עדין');

  // ── סבון ידיים ────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('סבון ידיים (HAND SOAP)');
  console.log('═'.repeat(70));
  await queryPattern('All סבון', 'סבון', 100);
  await queryPattern('סבון ידיים', '(?=.*סבון)(?=.*ידיים|יד)');
  await queryPattern('סבון נוזלי', '(?=.*סבון)(?=.*נוזלי)');
  await queryPattern('סבון מוצק / בר', '(?=.*סבון)(?=.*מוצק|בר|גוש)');
  await queryPattern('דאב / Dove soap', 'דאב');
  await queryPattern('פאלמוליב', 'פאלמוליב|palmolive');
  await queryPattern('פרוטקס / Protex', 'פרוטקס|protex|safeguard');

  // ── מגבונים ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('מגבונים (WIPES)');
  console.log('═'.repeat(70));
  await queryPattern('All מגבונים', 'מגבונ');
  await queryPattern('מגבונים לחים', '(?=.*מגבונ)(?=.*לחים|לח)');
  await queryPattern('מגבוני תינוק', '(?=.*מגבונ)(?=.*תינוק|בייבי|baby)');
  await queryPattern('מגבוני ניקוי', '(?=.*מגבונ)(?=.*ניקוי|פנים|גוף)');
  await queryPattern('מגבוני אנטיבקטריאל', '(?=.*מגבונ)(?=.*אנטי|חיידק|bacteria)');
  await queryPattern('מגבוני מטבח / משטחים', '(?=.*מגבונ)(?=.*מטבח|משטח|רצפה)');
  await queryPattern('האגיס מגבונים', '(?=.*מגבונ)(?=.*האגיס|huggies|pampers|פמפרס)');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
